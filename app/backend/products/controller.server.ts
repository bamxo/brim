import supabase from "../../db/supabase.server";

export async function getProductsWithRules(shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("products")
    .select(
      `
      id, title, variant_title, sku, current_stock, image_url,
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
    image_url: string | null;
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
    image_url: string | null;
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
  // Check-then-insert/update avoids relying on the DB unique constraint,
  // which may not exist on remote instances that haven't been fully migrated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("reorder_rules")
    .select("id")
    .eq("shop_id", payload.shop_id)
    .eq("product_id", payload.product_id)
    .maybeSingle();

  if (existing?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("reorder_rules")
      .update({
        primary_supplier_id: payload.primary_supplier_id,
        backup_supplier_id: payload.backup_supplier_id,
        reorder_point: payload.reorder_point,
        reorder_quantity: payload.reorder_quantity,
        unit_cost: payload.unit_cost,
        is_active: payload.is_active,
      })
      .eq("id", existing.id);

    if (error) return { error: error.message };
    return { error: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("reorder_rules")
    .insert(payload);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deactivateReorderRule(shopId: string, productId: string | undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("reorder_rules")
    .update({ is_active: false })
    .eq("product_id", productId)
    .eq("shop_id", shopId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function getAllProductsForShop(shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("products")
    .select("id, title, variant_title, sku, current_stock, image_url")
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
    image_url: string | null;
  }[];
}

export async function getProductsBySupplier(shopId: string, supplierId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("reorder_rules")
    .select(
      `
      reorder_point, reorder_quantity,
      product:products (id, title, variant_title, sku, current_stock, image_url)
    `,
    )
    .eq("shop_id", shopId)
    .eq("primary_supplier_id", supplierId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return ((data ?? []) as {
    reorder_point: number;
    reorder_quantity: number;
    product: {
      id: string;
      title: string;
      variant_title: string | null;
      sku: string | null;
      current_stock: number;
      image_url: string | null;
    } | null;
  }[])
    .filter((r) => r.product !== null)
    .map((r) => ({
      ...r.product!,
      reorder_point: r.reorder_point,
      reorder_quantity: r.reorder_quantity,
    }));
}

export async function getLastSyncedAt(shopId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("products")
    .select("last_synced_at")
    .eq("shop_id", shopId)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.last_synced_at as string | null) ?? null;
}

export async function deactivateDeletedProducts(
  shopId: string,
  activeShopifyProductIds: string[],
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dbProducts, error } = await (supabase as any)
    .from("products")
    .select("id, shopify_product_id")
    .eq("shop_id", shopId)
    .eq("is_active", true);

  if (error) return { error: error.message };
  if (!dbProducts?.length) return { error: null };

  const activeSet = new Set(activeShopifyProductIds);
  const toDeactivate = (dbProducts as { id: string; shopify_product_id: string }[])
    .filter((p) => !activeSet.has(p.shopify_product_id))
    .map((p) => p.id);

  if (!toDeactivate.length) return { error: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rulesError } = await (supabase as any)
    .from("reorder_rules")
    .update({ is_active: false })
    .eq("shop_id", shopId)
    .in("product_id", toDeactivate);

  if (rulesError) return { error: rulesError.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: productsError } = await (supabase as any)
    .from("products")
    .update({ is_active: false })
    .eq("shop_id", shopId)
    .in("id", toDeactivate);

  if (productsError) return { error: productsError.message };
  return { error: null };
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
