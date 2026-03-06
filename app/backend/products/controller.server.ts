import supabase from "../../db/supabase.server";

export async function getProductsWithRules(shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("products")
    .select(
      `
      id, title, variant_title, sku, current_stock,
      reorder_rules (
        id, reorder_point, reorder_quantity, is_active,
        primary_supplier:suppliers!primary_supplier_id (name)
      )
    `,
    )
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("title");

  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    current_stock: number;
    reorder_rules: {
      id: string;
      reorder_point: number;
      reorder_quantity: number;
      is_active: boolean;
      primary_supplier: { name: string } | null;
    }[];
  }[];
}

export async function getProductById(shopId: string, productId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("shop_id", shopId)
    .single();

  if (error || !data) return null;
  return data as {
    id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    current_stock: number;
    last_synced_at: string | null;
  };
}

export async function getReorderRuleForProduct(shopId: string, productId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("reorder_rules")
    .select(
      "*, primary_supplier:suppliers!primary_supplier_id(*), backup_supplier:suppliers!backup_supplier_id(*)",
    )
    .eq("product_id", productId)
    .eq("shop_id", shopId)
    .maybeSingle();

  return data ?? null;
}

export async function upsertReorderRule(payload: {
  shop_id: string;
  product_id: string | undefined;
  primary_supplier_id: string;
  backup_supplier_id: string | null;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number | null;
  is_active: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("reorder_rules")
    .upsert(payload, { onConflict: "shop_id,product_id" });

  if (error) return { error: error.message };
  return { error: null };
}

export async function deactivateReorderRule(shopId: string, productId: string | undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("reorder_rules")
    .update({ is_active: false })
    .eq("product_id", productId)
    .eq("shop_id", shopId);
}

export async function upsertProducts(
  shopId: string,
  rows: Record<string, unknown>[],
) {
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("products")
      .upsert(rows.slice(i, i + BATCH), {
        onConflict: "shop_id,shopify_variant_id",
      });

    if (error) return { error: error.message };
  }
  return { error: null };
}
