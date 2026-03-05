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

  const { data: existingLines } = await supabase
    .from("purchase_order_line_items")
    .select("product_id, purchase_orders!inner(shop_id, status)")
    .eq("purchase_orders.shop_id", shopId)
    .in("purchase_orders.status", ["draft", "sent", "confirmed", "in_transit"]);

  // deno-lint-ignore no-explicit-any
  const alreadyOrdered = new Set<string>((existingLines ?? []).map((l: any) => l.product_id));
  const actionable = triggered.filter((c) => !alreadyOrdered.has(c.product_id));
  const suppressedCount = triggered.length - actionable.length;

  if (actionable.length === 0) return { posCreated: 0, linesAdded: 0, suppressedCount };

  const bySupplier = new Map<string, ReorderCandidate[]>();
  for (const c of actionable) {
    const list = bySupplier.get(c.primary_supplier_id) ?? [];
    list.push(c);
    bySupplier.set(c.primary_supplier_id, list);
  }

  let posCreated = 0;
  let linesAdded = 0;

  for (const [supplierId, lines] of bySupplier) {
    const { data: existingDraft } = await supabase
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
      const { data: newPo } = await supabase
        .from("purchase_orders")
        .insert({ shop_id: shopId, supplier_id: supplierId, po_number: poNumber, status: "draft", currency, total_amount: 0 })
        .select("id")
        .single();
      poId = newPo!.id;
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

    await supabase.from("purchase_order_line_items").insert(lineItems);
    linesAdded += lineItems.length;

    const newTotal = lineItems.reduce((s, l) => s + (l.line_total ?? 0), 0);
    await supabase
      .from("purchase_orders")
      .update({ total_amount: (existingDraft?.total_amount ?? 0) + newTotal })
      .eq("id", poId);

    await supabase.from("inventory_trigger_log").insert(
      lines.map((c) => ({
        shop_id: shopId,
        product_id: c.product_id,
        triggered_at: new Date().toISOString(),
        stock_at_trigger: c.current_stock,
        reorder_point: c.reorder_point,
        action_taken: existingDraft ? "added_to_existing_po" : "draft_po_created",
        purchase_order_id: poId,
      })),
    );
  }

  return { posCreated, linesAdded, suppressedCount };
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
