import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../../shopify.server";
import supabase from "../../db/supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const { id: shopifyProductId } = payload as { id: number };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shopRow } = await (supabase as any)
    .from("shops")
    .select("id")
    .eq("shopify_domain", shop)
    .single();

  if (!shopRow) return new Response();

  // Fetch all variant rows for this product so we can deactivate their reorder rules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: productRows } = await (supabase as any)
    .from("products")
    .select("id")
    .eq("shop_id", shopRow.id)
    .eq("shopify_product_id", String(shopifyProductId));

  if (productRows?.length) {
    const productIds = (productRows as { id: string }[]).map((p) => p.id);

    // Deactivate reorder rules before soft-deleting the product rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: ruleError } = await (supabase as any)
      .from("reorder_rules")
      .update({ is_active: false })
      .eq("shop_id", shopRow.id)
      .in("product_id", productIds);

    if (ruleError) console.error("Failed to deactivate reorder rules:", ruleError.message);
  }

  // Soft-delete all variant rows for the deleted product
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("products")
    .update({ is_active: false })
    .eq("shop_id", shopRow.id)
    .eq("shopify_product_id", String(shopifyProductId));

  if (deleteError) console.error("Failed to soft-delete products:", deleteError.message);

  return new Response();
};
