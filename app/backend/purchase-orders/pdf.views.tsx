import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import supabase from "../../db/supabase.server";
import { generatePurchaseOrderPdf } from "./pdf/generator.server";
import type { PurchaseOrderPdfData, PdfAddress } from "./pdf/types";

const SHOP_QUERY = `#graphql
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

const LOCATION_QUERY = `#graphql
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

  // Fetch shop billing address and (optionally) location address in parallel
  const shopPromise = (admin.graphql as any)(SHOP_QUERY).then((r: any) => r.json());

  const locationPromise = po.delivery_location_id
    ? (admin.graphql as any)(LOCATION_QUERY, {
        variables: { id: po.delivery_location_id },
      }).then((r: any) => r.json())
    : Promise.resolve(null);

  const [shopData, locationData] = await Promise.all([shopPromise, locationPromise]);

  const shopInfo = shopData?.data?.shop;
  const billing = shopInfo?.billingAddress;

  const billTo: PdfAddress = {
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
  };

  const supplier = po.suppliers;
  const vendor: PdfAddress = {
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
  };

  const locInfo = locationData?.data?.location;
  const locAddr = locInfo?.address;
  const shipTo: PdfAddress = {
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
  };

  const pdfData: PurchaseOrderPdfData = {
    poNumber: po.po_number,
    poDate: po.created_at,
    requestedDeliveryDate: po.requested_delivery_date,
    notes: po.notes,
    currency: po.currency ?? "USD",
    totalAmount: po.total_amount ?? 0,
    billTo,
    vendor,
    shipTo,
    lineItems: (po.purchase_order_line_items ?? []).map((li: any) => ({
      product_name: li.product_name,
      variant_title: li.variant_title,
      sku: li.sku,
      quantity_ordered: li.quantity_ordered,
      unit_cost: li.unit_cost,
      line_total: li.line_total,
    })),
  };

  const pdfBuffer = await generatePurchaseOrderPdf(pdfData);

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${po.po_number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
};
