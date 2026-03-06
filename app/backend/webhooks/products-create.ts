import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../../shopify.server";
import { upsertProducts } from "../products/controller.server";
import supabase from "../../db/supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const product = payload as {
    id: number;
    title: string;
    image?: { src: string } | null;
    images?: { src: string }[];
    variants: Array<{
      id: number;
      title: string;
      sku: string | null;
      inventory_item_id: number;
    }>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shopRow } = await (supabase as any)
    .from("shops")
    .select("id")
    .eq("shopify_domain", shop)
    .single();

  if (!shopRow) return new Response();

  const imageUrl = product.image?.src ?? product.images?.[0]?.src ?? null;
  const now = new Date().toISOString();

  const rows = product.variants.map((variant) => ({
    shop_id: shopRow.id,
    shopify_product_id: String(product.id),
    shopify_variant_id: String(variant.id),
    shopify_inventory_item_id: String(variant.inventory_item_id),
    title: product.title,
    variant_title: variant.title === "Default Title" ? null : variant.title,
    sku: variant.sku || null,
    current_stock: 0,
    image_url: imageUrl,
    is_active: true,
    last_synced_at: now,
  }));

  const { error } = await upsertProducts(shopRow.id, rows);
  if (error) console.error(`products/create upsert failed for ${shop}:`, error);

  return new Response();
};
