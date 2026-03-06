import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import { sendPOEmail, getReplyToAddress } from "../email/service.server";
import supabase from "../../db/supabase.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po, error } = await (supabase as any)
    .from("purchase_orders")
    .select(
      `
      *,
      suppliers (id, name, email, phone),
      purchase_order_line_items (
        id, product_name, variant_title, sku,
        quantity_ordered, unit_cost, line_total, status
      )
    `,
    )
    .eq("id", params.id)
    .eq("shop_id", shop.id)
    .single();

  if (error || !po) throw new Response("Purchase order not found", { status: 404 });

  return { po };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-quantities") {
    const lineIds = formData.getAll("line_id") as string[];
    const quantities = formData.getAll("quantity") as string[];

    let total = 0;
    for (let i = 0; i < lineIds.length; i++) {
      const qty = Number(quantities[i]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: line } = await (supabase as any)
        .from("purchase_order_line_items")
        .update({ quantity_ordered: qty })
        .eq("id", lineIds[i])
        .select("unit_cost")
        .single();

      if (line?.unit_cost != null) total += line.unit_cost * qty;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("purchase_orders")
      .update({ total_amount: total })
      .eq("id", params.id)
      .eq("shop_id", shop.id);

    return { success: true, error: null };
  }

  if (intent === "mark-sent") {
    const sendMethod = formData.get("send_method") as string;

    if (sendMethod === "brim") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: po } = await (supabase as any)
        .from("purchase_orders")
        .select(
          `*, suppliers (name, email),
          purchase_order_line_items (
            product_name, variant_title, sku,
            quantity_ordered, unit_cost, line_total
          )`,
        )
        .eq("id", params.id)
        .eq("shop_id", shop.id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: shopRow } = await (supabase as any)
        .from("shops")
        .select("shop_name")
        .eq("id", shop.id)
        .single();

      try {
        await sendPOEmail({
          poId: params.id!,
          poNumber: po.po_number,
          supplierName: po.suppliers.name,
          supplierEmail: po.suppliers.email,
          lineItems: po.purchase_order_line_items,
          currency: po.currency,
          notes: po.notes,
          shopName: shopRow?.shop_name ?? shop.shopify_domain,
        });

        const replyTo = getReplyToAddress(params.id!);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("purchase_orders")
          .update({
            status: "sent",
            send_method: "brim",
            reply_to_address: replyTo,
            sent_at: new Date().toISOString(),
          })
          .eq("id", params.id)
          .eq("shop_id", shop.id);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("purchase_orders")
          .update({ status: "send_failed" })
          .eq("id", params.id)
          .eq("shop_id", shop.id);
        return {
          success: false,
          error: `Failed to send email: ${(err as Error).message}`,
        };
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("purchase_orders")
        .update({
          status: "sent",
          send_method: sendMethod,
          sent_at: new Date().toISOString(),
        })
        .eq("id", params.id)
        .eq("shop_id", shop.id);
    }

    return redirect(`/app/purchase-orders`);
  }

  if (intent === "dismiss") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("purchase_orders")
      .update({
        status: "dismissed",
        dismissed_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("shop_id", shop.id);

    return redirect(`/app/purchase-orders`);
  }

  return { success: false, error: "Unknown action" };
};

export { default } from "../../frontend/pages/PurchaseOrderDetailPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
