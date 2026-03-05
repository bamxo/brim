import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import {
  useActionData,
  useLoaderData,
  useNavigate,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";
import { sendPOEmail, getReplyToAddress } from "../lib/email.server";

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
      // Fetch full PO + lines + supplier for the email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: po } = await (supabase as any)
        .from("purchase_orders")
        .select(`
          *,
          suppliers (name, email),
          purchase_order_line_items (
            product_name, variant_title, sku,
            quantity_ordered, unit_cost, line_total
          )
        `)
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
        return { success: false, error: `Failed to send email: ${(err as Error).message}` };
      }
    } else {
      // clipboard — just mark as sent, no email
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

type LineItem = {
  id: string;
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  quantity_ordered: number;
  unit_cost: number | null;
  line_total: number | null;
  status: string;
};

export default function PurchaseOrderDetail() {
  const { po } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const isDraft = po.status === "draft";

  const handleSend = (sendMethod: string) => {
    const fd = new FormData();
    fd.append("intent", "mark-sent");
    fd.append("send_method", sendMethod);
    submit(fd, { method: "post" });
  };

  const handleDismiss = () => {
    if (!confirm("Dismiss this purchase order?")) return;
    const fd = new FormData();
    fd.append("intent", "dismiss");
    submit(fd, { method: "post" });
  };

  return (
    <s-page heading={po.po_number}>
      {isDraft && (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => handleSend("brim")}
        >
          Send via Brim
        </s-button>
      )}
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/purchase-orders")}
      >
        Back
      </s-button>

      {actionData?.error && (
        <s-banner tone="critical" heading="Error">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Order details" slot="aside">
        <s-paragraph>
          <s-text>Supplier: </s-text>
          <s-text>{po.suppliers?.name ?? "—"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Supplier email: </s-text>
          <s-text>{po.suppliers?.email ?? "—"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Status: </s-text>
          <s-text>{po.status}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Total: </s-text>
          <s-text>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: po.currency,
            }).format(po.total_amount)}
          </s-text>
        </s-paragraph>
        {po.confirmed_delivery_date && (
          <s-paragraph>
            <s-text>Delivery date: </s-text>
            <s-text>
              {new Date(po.confirmed_delivery_date).toLocaleDateString()}
            </s-text>
          </s-paragraph>
        )}
        {po.notes && (
          <s-paragraph>
            <s-text>Notes: </s-text>
            <s-text>{po.notes}</s-text>
          </s-paragraph>
        )}
      </s-section>

      <s-section heading="Line items">
        <form method="post">
          <input type="hidden" name="intent" value="update-quantities" />
          <s-table>
            <s-table-header-row>
              <s-table-header>Product</s-table-header>
              <s-table-header>SKU</s-table-header>
              <s-table-header>Qty</s-table-header>
              <s-table-header>Unit cost</s-table-header>
              <s-table-header>Line total</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {po.purchase_order_line_items.map((line: LineItem) => (
                <s-table-row key={line.id}>
                  <s-table-cell>
                    {line.product_name}
                    {line.variant_title ? ` — ${line.variant_title}` : ""}
                  </s-table-cell>
                  <s-table-cell>{line.sku ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <input type="hidden" name="line_id" value={line.id} />
                    {isDraft ? (
                      <s-number-field
                        name="quantity"
                        label="Quantity"
                        label-hidden
                        min="0"
                        value={String(line.quantity_ordered)}
                      />
                    ) : (
                      String(line.quantity_ordered)
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    {line.unit_cost != null
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: po.currency,
                        }).format(line.unit_cost)
                      : "—"}
                  </s-table-cell>
                  <s-table-cell>
                    {line.line_total != null
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: po.currency,
                        }).format(line.line_total)
                      : "—"}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
          {isDraft && (
            <s-stack direction="inline" gap="base">
              <s-button submit>Update quantities</s-button>
            </s-stack>
          )}
        </form>
      </s-section>

      {isDraft && (
        <s-section heading="Send this order" slot="aside">
          <s-paragraph>
            Choose how to send this purchase order to{" "}
            {po.suppliers?.name ?? "your supplier"}.
          </s-paragraph>
          <s-stack direction="block" gap="base">
            <s-button variant="primary" onClick={() => handleSend("brim")}>
              Send via Brim email
            </s-button>
            <s-button onClick={() => handleSend("clipboard")}>
              Copy to clipboard
            </s-button>
            <s-button disabled>
              Send via Gmail (coming soon)
            </s-button>
          </s-stack>
          <s-divider />
          <s-button tone="critical" onClick={handleDismiss}>
            Dismiss order
          </s-button>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
