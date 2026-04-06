import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import supabase from "../../db/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: purchaseOrders, error } = await (supabase as any)
    .from("purchase_orders")
    .select(
      `
      id, po_number, status, is_urgent,
      total_amount, currency, created_at,
      confirmed_delivery_date, sent_at,
      suppliers (name),
      purchase_order_line_items (product_name, quantity_ordered)
    `,
    )
    .eq("shop_id", shop.id)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return { purchaseOrders: purchaseOrders ?? [] };
};

export { default } from "../../frontend/pages/PurchaseOrdersPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
