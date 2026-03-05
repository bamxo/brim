import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import supabase from "../supabase.server";
import { checkAndTriggerReorder } from "../lib/po.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const { inventory_item_id, available } = payload as {
    inventory_item_id: number;
    available: number;
  };

  if (available == null) return new Response();

  // Update current_stock for the matching product
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shopRow } = await (supabase as any)
    .from("shops")
    .select("id")
    .eq("shopify_domain", shop)
    .single();

  if (!shopRow) return new Response();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("products")
    .update({
      current_stock: available,
      last_synced_at: new Date().toISOString(),
    })
    .eq("shopify_inventory_item_id", String(inventory_item_id))
    .eq("shop_id", shopRow.id);

  // Check if this stock change crosses a reorder threshold
  await checkAndTriggerReorder(
    shopRow.id,
    String(inventory_item_id),
    available,
  );

  return new Response();
};
