import supabase from "../../db/supabase.server";

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
    return { posCreated: 0, linesAdded: 0, suppressedCount: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shopRow } = await (supabase as any)
    .from("shops")
    .select("currency")
    .eq("id", shopId)
    .single();
  const currency: string = shopRow?.currency ?? "USD";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingLines } = await (supabase as any)
    .from("purchase_order_line_items")
    .select(
      `
      product_id,
      purchase_orders!inner (
        shop_id,
        status
      )
    `,
    )
    .eq("purchase_orders.shop_id", shopId)
    .in("purchase_orders.status", ["draft", "sent", "confirmed", "in_transit"]);

  const alreadyOrderedProductIds = new Set<string>(
    (existingLines ?? []).map((l: { product_id: string }) => l.product_id),
  );

  const actionable = triggeredCandidates.filter(
    (c) => !alreadyOrderedProductIds.has(c.product_id),
  );
  const suppressedCount = triggeredCandidates.length - actionable.length;

  if (actionable.length === 0) {
    return { posCreated: 0, linesAdded: 0, suppressedCount };
  }

  const bySupplier = new Map<string, ReorderCandidate[]>();
  for (const candidate of actionable) {
    const existing = bySupplier.get(candidate.primary_supplier_id) ?? [];
    existing.push(candidate);
    bySupplier.set(candidate.primary_supplier_id, existing);
  }

  let posCreated = 0;
  let linesAdded = 0;

  for (const [supplierId, lines] of bySupplier) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingDraft } = await (supabase as any)
      .from("purchase_orders")
      .select("id, total_amount")
      .eq("shop_id", shopId)
      .eq("supplier_id", supplierId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let poId: string;

    if (existingDraft) {
      poId = existingDraft.id;
    } else {
      const poNumber = await generatePoNumber(shopId);
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

    const lineItems = lines.map((c) => ({
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

    const newTotal = lineItems.reduce((sum, l) => sum + (l.line_total ?? 0), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("purchase_orders")
      .update({
        total_amount: existingDraft
          ? (existingDraft.total_amount ?? 0) + newTotal
          : newTotal,
      })
      .eq("id", poId);

    const triggerLogs = lines.map((c) => ({
      shop_id: shopId,
      product_id: c.product_id,
      triggered_at: new Date().toISOString(),
      stock_at_trigger: c.current_stock,
      reorder_point: c.reorder_point,
      action_taken: existingDraft ? "added_to_existing_po" : "draft_po_created",
      purchase_order_id: poId,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: logError } = await (supabase as any).from("inventory_trigger_log").insert(triggerLogs);
    if (logError) console.error("Failed to insert trigger logs:", logError.message);
  }

  if (suppressedCount > 0) {
    const suppressedLogs = triggeredCandidates
      .filter((c) => alreadyOrderedProductIds.has(c.product_id))
      .map((c) => ({
        shop_id: shopId,
        product_id: c.product_id,
        triggered_at: new Date().toISOString(),
        stock_at_trigger: c.current_stock,
        reorder_point: c.reorder_point,
        action_taken: "suppressed_po_in_transit",
        purchase_order_id: null,
      }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: suppressedLogError } = await (supabase as any).from("inventory_trigger_log").insert(suppressedLogs);
    if (suppressedLogError) console.error("Failed to insert suppressed trigger logs:", suppressedLogError.message);
  }

  return { posCreated, linesAdded, suppressedCount };
}

export async function checkAndTriggerReorder(
  shopId: string,
  shopifyInventoryItemId: string,
  newStock: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product } = await (supabase as any)
    .from("products")
    .select("id, current_stock")
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

  const wasAbove = product.current_stock > rule.reorder_point;
  const isNowAtOrBelow = newStock <= rule.reorder_point;

  if (wasAbove && isNowAtOrBelow) {
    await generateDraftPOs(shopId);
  }
}
