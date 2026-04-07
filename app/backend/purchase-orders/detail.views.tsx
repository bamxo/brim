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
import { generatePurchaseOrderPdf } from "./pdf/generator.server";
import type { PurchaseOrderPdfData } from "./pdf/types";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po, error } = await (supabase as any)
    .from("purchase_orders")
    .select(
      `
      *,
      suppliers (id, name, email, phone, address1, address2, city, province, zip, country),
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

  // Generate PDF preview as base64 data URL
  let pdfDataUrl: string | null = null;
  try {
    const [shopGql, locationGql] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin.graphql as any)(SHOP_BILLING_QUERY).then((r: any) => r.json()),
      po.delivery_location_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (admin.graphql as any)(LOCATION_ADDRESS_QUERY, {
            variables: { id: po.delivery_location_id },
          }).then((r: any) => r.json())
        : Promise.resolve(null),
    ]);

    const shopInfo = shopGql?.data?.shop;
    const billing = shopInfo?.billingAddress;
    const locInfo = locationGql?.data?.location;
    const locAddr = locInfo?.address;
    const supplier = po.suppliers;

    const pdfData: PurchaseOrderPdfData = {
      poNumber: po.po_number,
      poDate: po.created_at,
      requestedDeliveryDate: po.requested_delivery_date,
      notes: po.notes,
      currency: po.currency ?? "USD",
      totalAmount: po.total_amount ?? 0,
      billTo: {
        company: billing?.company ?? shopInfo?.name ?? null,
        name: null,
        address1: billing?.address1 ?? null,
        address2: billing?.address2 ?? null,
        city: billing?.city ?? null,
        province: billing?.province ?? null,
        zip: billing?.zip ?? null,
        country: billing?.country ?? null,
        phone: billing?.phone ?? null,
        email: shopInfo?.contactEmail ?? shopInfo?.email ?? null,
      },
      vendor: {
        company: supplier?.name ?? null,
        name: null,
        address1: supplier?.address1 ?? null,
        address2: supplier?.address2 ?? null,
        city: supplier?.city ?? null,
        province: supplier?.province ?? null,
        zip: supplier?.zip ?? null,
        country: supplier?.country ?? null,
        phone: supplier?.phone ?? null,
        email: supplier?.email ?? null,
      },
      shipTo: {
        company: locInfo?.name ?? po.delivery_location ?? null,
        name: null,
        address1: locAddr?.address1 ?? null,
        address2: locAddr?.address2 ?? null,
        city: locAddr?.city ?? null,
        province: locAddr?.province ?? null,
        zip: locAddr?.zip ?? null,
        country: locAddr?.country ?? null,
        phone: locAddr?.phone ?? null,
        email: null,
      },
      lineItems: (po.purchase_order_line_items ?? []).map((li: any) => ({
        product_name: li.product_name,
        variant_title: li.variant_title,
        sku: li.sku,
        quantity_ordered: li.quantity_ordered,
        unit_cost: li.unit_cost,
        line_total: li.line_total,
      })),
    };

    const buffer = await generatePurchaseOrderPdf(pdfData);
    pdfDataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
  } catch {
    // PDF generation failure should not block page load
  }

  return { po, pdfDataUrl };
};

const SHOP_BILLING_QUERY = `#graphql
  query ShopBillingAddress {
    shop {
      name
      email
      contactEmail
      billingAddress {
        address1
        address2
        city
        province
        zip
        country
        phone
        company
      }
    }
  }
`;

const LOCATION_ADDRESS_QUERY = `#graphql
  query LocationAddress($id: ID!) {
    location(id: $id) {
      name
      address {
        address1
        address2
        city
        province
        zip
        country
        phone
      }
    }
  }
`;

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-quantities") {
    const lineIds = formData.getAll("line_id") as string[];
    const quantities = formData.getAll("quantity") as string[];

    for (const q of quantities) {
      const n = Number(q);
      if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
        return { success: false, error: "Invalid quantity" };
      }
    }

    let total = 0;
    for (let i = 0; i < lineIds.length; i++) {
      const qty = Number(quantities[i]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: line } = await (supabase as any)
        .from("purchase_order_line_items")
        .update({ quantity_ordered: qty })
        .eq("id", lineIds[i])
        .eq("purchase_order_id", params.id)
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
          `*, suppliers (name, email, phone, address1, address2, city, province, zip, country),
          purchase_order_line_items (
            product_name, variant_title, sku,
            quantity_ordered, unit_cost, line_total
          )`,
        )
        .eq("id", params.id)
        .eq("shop_id", shop.id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [shopRow, shopGql, locationGql] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("shops").select("shop_name").eq("id", shop.id).single(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin.graphql as any)(SHOP_BILLING_QUERY).then((r: any) => r.json()),
        po.delivery_location_id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (admin.graphql as any)(LOCATION_ADDRESS_QUERY, {
              variables: { id: po.delivery_location_id },
            }).then((r: any) => r.json())
          : Promise.resolve(null),
      ]);

      const shopInfo = shopGql?.data?.shop;
      const billing = shopInfo?.billingAddress;
      const locInfo = locationGql?.data?.location;
      const locAddr = locInfo?.address;
      const supplier = po.suppliers;

      const pdfData: PurchaseOrderPdfData = {
        poNumber: po.po_number,
        poDate: po.created_at,
        requestedDeliveryDate: po.requested_delivery_date,
        notes: po.notes,
        currency: po.currency ?? "USD",
        totalAmount: po.total_amount ?? 0,
        billTo: {
          company: billing?.company ?? shopInfo?.name ?? null,
          name: null,
          address1: billing?.address1 ?? null,
          address2: billing?.address2 ?? null,
          city: billing?.city ?? null,
          province: billing?.province ?? null,
          zip: billing?.zip ?? null,
          country: billing?.country ?? null,
          phone: billing?.phone ?? null,
          email: shopInfo?.contactEmail ?? shopInfo?.email ?? null,
        },
        vendor: {
          company: supplier?.name ?? null,
          name: null,
          address1: supplier?.address1 ?? null,
          address2: supplier?.address2 ?? null,
          city: supplier?.city ?? null,
          province: supplier?.province ?? null,
          zip: supplier?.zip ?? null,
          country: supplier?.country ?? null,
          phone: supplier?.phone ?? null,
          email: supplier?.email ?? null,
        },
        shipTo: {
          company: locInfo?.name ?? po.delivery_location ?? null,
          name: null,
          address1: locAddr?.address1 ?? null,
          address2: locAddr?.address2 ?? null,
          city: locAddr?.city ?? null,
          province: locAddr?.province ?? null,
          zip: locAddr?.zip ?? null,
          country: locAddr?.country ?? null,
          phone: locAddr?.phone ?? null,
          email: null,
        },
        lineItems: (po.purchase_order_line_items ?? []).map((li: any) => ({
          product_name: li.product_name,
          variant_title: li.variant_title,
          sku: li.sku,
          quantity_ordered: li.quantity_ordered,
          unit_cost: li.unit_cost,
          line_total: li.line_total,
        })),
      };

      let pdfBuffer: Buffer | null = null;
      try {
        pdfBuffer = await generatePurchaseOrderPdf(pdfData);
      } catch {
        // PDF generation failure should not block sending the email
      }

      try {
        await sendPOEmail({
          poId: params.id!,
          poNumber: po.po_number,
          supplierName: po.suppliers.name,
          supplierEmail: po.suppliers.email,
          lineItems: po.purchase_order_line_items,
          currency: po.currency,
          notes: po.notes,
          shopName: shopRow?.data?.shop_name ?? shop.shopify_domain,
          pdfBuffer,
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
