import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../../shopify.server";
import supabase from "../../db/supabase.server";
import { checkAndTriggerReorder } from "../purchase-orders/controller.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const { inventory_item_id, available } = payload as {
    inventory_item_id: number;
    available: number;
  };

  if (available == null) return new Response();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shopRow } = await (supabase as any)
    .from("shops")
    .select("id")
    .eq("shopify_domain", shop)
    .single();

  if (!shopRow) return new Response();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("products")
    .update({
      current_stock: available,
      last_synced_at: new Date().toISOString(),
    })
    .eq("shopify_inventory_item_id", String(inventory_item_id))
    .eq("shop_id", shopRow.id);

  if (updateError) console.error("Failed to update product stock:", updateError.message);

  await checkAndTriggerReorder(shopRow.id, String(inventory_item_id), available);

  return new Response();
};
