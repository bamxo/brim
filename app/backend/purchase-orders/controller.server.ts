import supabase from "../../db/supabase.server";
import { dispatchReorderNotification } from "../notifications/controller.server";

type ReorderCandidate = {
  product_id: string;
  shop_id: string;
  current_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number | null;
  primary_supplier_id: string;
  rule_id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  shopify_variant_id: string;
};

type CreatedPO = {
  poId: string;
  poNumber: string;
  productNames: string[];
};

export async function generatePoNumber(shopId: string): Promise<string> {
  const year = new Date().getFullYear();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .like("po_number", `PO-${year}-%`);

  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `PO-${year}-${seq}`;
}

export async function generateDraftPOs(shopId: string): Promise<{
  posCreated: number;
  linesAdded: number;
  suppressedCount: number;
  createdPOs: CreatedPO[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: candidates, error: ruleError } = await (supabase as any)
    .from("reorder_rules")
    .select(
      `
      id,
      shop_id,
      product_id,
      primary_supplier_id,
      reorder_point,
      reorder_quantity,
      unit_cost,
      products!inner (
        id,
        title,
        variant_title,
        sku,
        shopify_variant_id,
        current_stock,
        is_active
      )
    `,
    )
    .eq("shop_id", shopId)
    .eq("is_active", true);

  if (ruleError) throw new Error(`Failed to fetch reorder rules: ${ruleError.message}`);

  const triggeredCandidates: ReorderCandidate[] = (candidates ?? [])
    .filter(
      (c: {
        products: { current_stock: number; is_active: boolean };
        reorder_point: number;
      }) =>
        c.products.is_active &&
        c.products.current_stock <= c.reorder_point,
    )
    .map(
      (c: {
        id: string;
        shop_id: string;
        product_id: string;
        primary_supplier_id: string;
        reorder_point: number;
        reorder_quantity: number;
        unit_cost: number | null;
        products: {
          title: string;
          variant_title: string | null;
          sku: string | null;
          shopify_variant_id: string;
          current_stock: number;
        };
      }) => ({
        rule_id: c.id,
        shop_id: c.shop_id,
        product_id: c.product_id,
        primary_supplier_id: c.primary_supplier_id,
        reorder_point: c.reorder_point,
        reorder_quantity: c.reorder_quantity,
        unit_cost: c.unit_cost,
        title: c.products.title,
        variant_title: c.products.variant_title,
        sku: c.products.sku,
        shopify_variant_id: c.products.shopify_variant_id,
        current_stock: c.products.current_stock,
      }),
    );

  if (triggeredCandidates.length === 0) {
    return { posCreated: 0, linesAdded: 0, suppressedCount: 0, createdPOs: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shopRow } = await (supabase as any)
    .from("shops")
    .select("currency")
    .eq("id", shopId)
    .single();
  const currency: string = shopRow?.currency ?? "USD";

  // Check which products have already been reorder-triggered for an open PO.
  // These are skipped to avoid adding reorder_quantity on every sync.
  // Products on open POs that were NOT reorder-triggered (i.e. manually added)
  // will have reorder_quantity added to their existing line.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: triggerLogs } = await (supabase as any)
    .from("inventory_trigger_log")
    .select(
      `
      product_id,
      purchase_order_id,
      purchase_orders!inner (
        shop_id,
        status
      )
    `,
    )
    .eq("purchase_orders.shop_id", shopId)
    .in("purchase_orders.status", ["draft", "sent", "confirmed", "in_transit"])
    .in("action_taken", ["draft_po_created", "added_to_existing_po"]);

  const alreadyReorderTriggered = new Set<string>(
    (triggerLogs ?? []).map((l: { product_id: string }) => l.product_id),
  );

  const actionable = triggeredCandidates.filter(
    (c) => !alreadyReorderTriggered.has(c.product_id),
  );

  if (actionable.length === 0) {
    return { posCreated: 0, linesAdded: 0, suppressedCount: 0, createdPOs: [] };
  }

  const bySupplier = new Map<string, ReorderCandidate[]>();
  for (const candidate of actionable) {
    const existing = bySupplier.get(candidate.primary_supplier_id) ?? [];
    existing.push(candidate);
    bySupplier.set(candidate.primary_supplier_id, existing);
  }

  let posCreated = 0;
  let linesAdded = 0;
  let linesUpdated = 0;
  const createdPOs: CreatedPO[] = [];

  for (const [supplierId, lines] of bySupplier) {
    // Find the first open PO for this supplier to merge into
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: openPO } = await (supabase as any)
      .from("purchase_orders")
      .select("id, po_number, total_amount")
      .eq("shop_id", shopId)
      .eq("supplier_id", supplierId)
      .in("status", ["draft", "sent", "confirmed", "in_transit"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let poId: string;
    let poNumber: string;

    if (openPO) {
      poId = openPO.id;
      poNumber = openPO.po_number;
    } else {
      poNumber = await generatePoNumber(shopId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newPo, error: poError } = await (supabase as any)
        .from("purchase_orders")
        .insert({
          shop_id: shopId,
          supplier_id: supplierId,
          po_number: poNumber,
          status: "draft",
          currency,
          total_amount: 0,
        })
        .select("id")
        .single();

      if (poError) throw new Error(`Failed to create PO: ${poError.message}`);
      poId = newPo.id;
      posCreated++;
    }

    // Check which products already have a line on this PO (manually added)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingLineItems } = await (supabase as any)
      .from("purchase_order_line_items")
      .select("id, product_id, quantity_ordered, unit_cost")
      .eq("purchase_order_id", poId);

    const existingByProduct = new Map<string, {
      id: string;
      quantity_ordered: number;
      unit_cost: number | null;
    }>();
    for (const li of (existingLineItems ?? []) as {
      id: string;
      product_id: string;
      quantity_ordered: number;
      unit_cost: number | null;
    }[]) {
      existingByProduct.set(li.product_id, li);
    }

    const toInsert: ReorderCandidate[] = [];
    const toUpdate: { candidate: ReorderCandidate; existingLine: { id: string; quantity_ordered: number; unit_cost: number | null } }[] = [];

    for (const c of lines) {
      const existing = existingByProduct.get(c.product_id);
      if (existing) {
        toUpdate.push({ candidate: c, existingLine: existing });
      } else {
        toInsert.push(c);
      }
    }

    // Update existing lines: add reorder_quantity to existing quantity_ordered
    let totalDelta = 0;
    for (const { candidate, existingLine } of toUpdate) {
      const newQty = existingLine.quantity_ordered + candidate.reorder_quantity;
      const cost = candidate.unit_cost ?? existingLine.unit_cost;
      const newLineTotal = cost != null ? cost * newQty : null;
      const oldLineTotal = existingLine.unit_cost != null
        ? existingLine.unit_cost * existingLine.quantity_ordered
        : 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("purchase_order_line_items")
        .update({
          quantity_ordered: newQty,
          unit_cost: cost,
          line_total: newLineTotal,
        })
        .eq("id", existingLine.id);

      totalDelta += (newLineTotal ?? 0) - oldLineTotal;
      linesUpdated++;
    }

    // Insert new lines
    if (toInsert.length > 0) {
      const lineItems = toInsert.map((c) => ({
        purchase_order_id: poId,
        product_id: c.product_id,
        shopify_variant_id: c.shopify_variant_id,
        sku: c.sku,
        product_name: c.title,
        variant_title: c.variant_title,
        quantity_ordered: c.reorder_quantity,
        unit_cost: c.unit_cost,
        line_total: c.unit_cost != null ? c.unit_cost * c.reorder_quantity : null,
        status: "pending",
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: lineError } = await (supabase as any)
        .from("purchase_order_line_items")
        .insert(lineItems);

      if (lineError) throw new Error(`Failed to insert PO lines: ${lineError.message}`);
      linesAdded += lineItems.length;
      totalDelta += lineItems.reduce((sum, l) => sum + (l.line_total ?? 0), 0);
    }

    if (toInsert.length === 0 && toUpdate.length === 0) continue;

    // Update PO total
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("purchase_orders")
      .update({
        total_amount: (openPO?.total_amount ?? 0) + totalDelta,
      })
      .eq("id", poId);

    const allAffected = [...toInsert, ...toUpdate.map((u) => u.candidate)];
    createdPOs.push({
      poId,
      poNumber,
      productNames: allAffected.map((c) => c.title),
    });

    // Log the trigger so subsequent runs know this reorder was already handled
    const newTriggerLogs = allAffected.map((c) => ({
      shop_id: shopId,
      product_id: c.product_id,
      triggered_at: new Date().toISOString(),
      stock_at_trigger: c.current_stock,
      reorder_point: c.reorder_point,
      action_taken: openPO ? "added_to_existing_po" : "draft_po_created",
      purchase_order_id: poId,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: logError } = await (supabase as any).from("inventory_trigger_log").insert(newTriggerLogs);
    if (logError) console.error("Failed to insert trigger logs:", logError.message);
  }

  return { posCreated, linesAdded, suppressedCount: 0, createdPOs };
}

export async function checkAndTriggerReorder(
  shopId: string,
  shopifyInventoryItemId: string,
  newStock: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product } = await (supabase as any)
    .from("products")
    .select("id")
    .eq("shop_id", shopId)
    .eq("shopify_inventory_item_id", shopifyInventoryItemId)
    .single();

  if (!product) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rule } = await (supabase as any)
    .from("reorder_rules")
    .select("reorder_point")
    .eq("shop_id", shopId)
    .eq("product_id", product.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!rule) return;

  // The webhook handler updates current_stock BEFORE calling this function,
  // so we compare the incoming newStock directly against the reorder point.
  // Duplicate PO creation is already prevented by generateDraftPOs which
  // skips products that already have open POs (draft/sent/confirmed/in_transit).
  if (newStock > rule.reorder_point) return;

  const result = await generateDraftPOs(shopId);

  for (const po of result.createdPOs) {
    await dispatchReorderNotification({
      shopId,
      poId: po.poId,
      poNumber: po.poNumber,
      productNames: po.productNames,
    });
  }
}
