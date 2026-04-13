import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type ReorderCandidate = {
  rule_id: string;
  shop_id: string;
  product_id: string;
  primary_supplier_id: string;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  shopify_variant_id: string;
  current_stock: number;
};

async function generatePoNumber(shopId: string): Promise<string> {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");

  const { count } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .like("po_number", `PO-${datePart}-%`);

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `PO-${datePart}-${seq}`;
}

async function procesShop(shopId: string): Promise<{
  posCreated: number;
  linesAdded: number;
  suppressedCount: number;
}> {
  const { data: candidates } = await supabase
    .from("reorder_rules")
    .select(`
      id, shop_id, product_id, primary_supplier_id,
      reorder_point, reorder_quantity, unit_cost,
      products!inner (
        id, title, variant_title, sku,
        shopify_variant_id, current_stock, is_active
      )
    `)
    .eq("shop_id", shopId)
    .eq("is_active", true);

  const triggered: ReorderCandidate[] = (candidates ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((c: any) => c.products.is_active && c.products.current_stock <= c.reorder_point)
    // deno-lint-ignore no-explicit-any
    .map((c: any) => ({
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
    }));

  if (triggered.length === 0) return { posCreated: 0, linesAdded: 0, suppressedCount: 0 };

  const { data: shopRow } = await supabase
    .from("shops")
    .select("currency")
    .eq("id", shopId)
    .single();
  const currency = shopRow?.currency ?? "USD";

  // Check which products have already been reorder-triggered for an open PO.
  // Skip those — but products manually added to a PO get reorder_quantity added.
  const { data: existingTriggerLogs } = await supabase
    .from("inventory_trigger_log")
    .select("product_id, purchase_order_id, purchase_orders!inner(shop_id, status)")
    .eq("purchase_orders.shop_id", shopId)
    .in("purchase_orders.status", ["draft", "sent", "confirmed", "in_transit"])
    .in("action_taken", ["draft_po_created", "added_to_existing_po"]);

  // deno-lint-ignore no-explicit-any
  const alreadyReorderTriggered = new Set<string>((existingTriggerLogs ?? []).map((l: any) => l.product_id));
  const actionable = triggered.filter((c) => !alreadyReorderTriggered.has(c.product_id));

  if (actionable.length === 0) return { posCreated: 0, linesAdded: 0, suppressedCount: 0 };

  const bySupplier = new Map<string, ReorderCandidate[]>();
  for (const c of actionable) {
    const list = bySupplier.get(c.primary_supplier_id) ?? [];
    list.push(c);
    bySupplier.set(c.primary_supplier_id, list);
  }

  let posCreated = 0;
  let linesAdded = 0;
  let linesUpdated = 0;

  for (const [supplierId, lines] of bySupplier) {
    const { data: openPO } = await supabase
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
      const { data: newPo } = await supabase
        .from("purchase_orders")
        .insert({ shop_id: shopId, supplier_id: supplierId, po_number: poNumber, status: "draft", currency, total_amount: 0 })
        .select("id")
        .single();
      poId = newPo!.id;
      posCreated++;
    }

    // Check which products already have a line on this PO (manually added)
    const { data: existingLineItems } = await supabase
      .from("purchase_order_line_items")
      .select("id, product_id, quantity_ordered, unit_cost")
      .eq("purchase_order_id", poId);

    // deno-lint-ignore no-explicit-any
    const existingByProduct = new Map<string, any>();
    for (const li of (existingLineItems ?? []) as { id: string; product_id: string; quantity_ordered: number; unit_cost: number | null }[]) {
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

    let totalDelta = 0;
    for (const { candidate, existingLine } of toUpdate) {
      const newQty = existingLine.quantity_ordered + candidate.reorder_quantity;
      const cost = candidate.unit_cost ?? existingLine.unit_cost;
      const newLineTotal = cost != null ? cost * newQty : null;
      const oldLineTotal = existingLine.unit_cost != null
        ? existingLine.unit_cost * existingLine.quantity_ordered
        : 0;

      await supabase
        .from("purchase_order_line_items")
        .update({ quantity_ordered: newQty, unit_cost: cost, line_total: newLineTotal })
        .eq("id", existingLine.id);

      totalDelta += (newLineTotal ?? 0) - oldLineTotal;
      linesUpdated++;
    }

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

      await supabase.from("purchase_order_line_items").insert(lineItems);
      linesAdded += lineItems.length;
      totalDelta += lineItems.reduce((s, l) => s + (l.line_total ?? 0), 0);
    }

    if (toInsert.length === 0 && toUpdate.length === 0) continue;

    await supabase
      .from("purchase_orders")
      .update({ total_amount: (openPO?.total_amount ?? 0) + totalDelta })
      .eq("id", poId);

    const allAffected = [...toInsert, ...toUpdate.map((u) => u.candidate)];
    await supabase.from("inventory_trigger_log").insert(
      allAffected.map((c) => ({
        shop_id: shopId,
        product_id: c.product_id,
        triggered_at: new Date().toISOString(),
        stock_at_trigger: c.current_stock,
        reorder_point: c.reorder_point,
        action_taken: openPO ? "added_to_existing_po" : "draft_po_created",
        purchase_order_id: poId,
      })),
    );
  }

  return { posCreated, linesAdded, suppressedCount: 0 };
}

Deno.serve(async (_req) => {
  const { data: shops } = await supabase
    .from("shops")
    .select("id")
    .eq("is_active", true);

  if (!shops?.length) {
    return new Response(JSON.stringify({ message: "No active shops" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await Promise.allSettled(
    shops.map((s: { id: string }) => procesShop(s.id)),
  );

  const summary = results.map((r, i) => ({
    shopId: shops[i].id,
    ...(r.status === "fulfilled" ? r.value : { error: r.reason?.message }),
  }));

  console.log("check-reorders complete", JSON.stringify(summary));

  return new Response(JSON.stringify({ summary }), {
    headers: { "Content-Type": "application/json" },
  });
});
