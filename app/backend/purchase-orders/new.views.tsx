import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import { getActiveSuppliersMinimal } from "../suppliers/controller.server";
import { generatePoNumber } from "./controller.server";
import supabase from "../../db/supabase.server";

const LOCATIONS_QUERY = `#graphql
  query GetLocations {
    locations(first: 50) {
      nodes {
        id
        name
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const [suppliers, products, locationsResponse, shopRow] = await Promise.all([
    getActiveSuppliersMinimal(shop.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("products")
      .select("id, title, variant_title, sku, image_url, current_stock, shopify_variant_id")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("title"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.graphql as any)(LOCATIONS_QUERY),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("shops")
      .select("currency")
      .eq("id", shop.id)
      .single(),
  ]);

  const locationsData = await locationsResponse.json();
  const locations = (locationsData?.data?.locations?.nodes ?? []) as {
    id: string;
    name: string;
  }[];

  return {
    suppliers,
    products: (products.data ?? []) as {
      id: string;
      title: string;
      variant_title: string | null;
      sku: string | null;
      image_url: string | null;
      current_stock: number;
      shopify_variant_id: string;
    }[],
    locations,
    currency: (shopRow?.data?.currency as string) ?? "USD",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();

  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const lineItemsJson = String(formData.get("line_items") ?? "[]");
  const deliveryLocation = String(formData.get("delivery_location") ?? "").trim();
  const requestedDeliveryDate = String(formData.get("requested_delivery_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!supplierId) return { errors: { supplier_id: "Supplier is required" } };
  if (!deliveryLocation) return { errors: { delivery_location: "Delivery location is required" } };

  let lineItems: {
    product_id: string;
    shopify_variant_id: string;
    product_name: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    unit_cost: number | null;
  }[];

  try {
    lineItems = JSON.parse(lineItemsJson);
  } catch {
    return { errors: { form: "Invalid line items data" } };
  }

  if (!lineItems.length) {
    return { errors: { line_items: "At least one product is required" } };
  }

  const poNumber = await generatePoNumber(shop.id);

  const totalAmount = lineItems.reduce((sum, li) => {
    if (li.unit_cost != null) return sum + li.unit_cost * li.quantity;
    return sum;
  }, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shopRow } = await (supabase as any)
    .from("shops")
    .select("currency")
    .eq("id", shop.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newPo, error: poError } = await (supabase as any)
    .from("purchase_orders")
    .insert({
      shop_id: shop.id,
      supplier_id: supplierId,
      po_number: poNumber,
      status: "draft",
      currency: shopRow?.currency ?? "USD",
      total_amount: totalAmount,
      requested_delivery_date: requestedDeliveryDate,
      delivery_location: deliveryLocation,
      notes,
    })
    .select("id")
    .single();

  if (poError) return { errors: { form: `Failed to create PO: ${poError.message}` } };

  const rows = lineItems.map((li) => ({
    purchase_order_id: newPo.id,
    product_id: li.product_id,
    shopify_variant_id: li.shopify_variant_id,
    sku: li.sku,
    product_name: li.product_name,
    variant_title: li.variant_title,
    quantity_ordered: li.quantity,
    unit_cost: li.unit_cost,
    line_total: li.unit_cost != null ? li.unit_cost * li.quantity : null,
    status: "pending",
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: lineError } = await (supabase as any)
    .from("purchase_order_line_items")
    .insert(rows);

  if (lineError) return { errors: { form: `Failed to add line items: ${lineError.message}` } };

  return redirect(`/app/purchase-orders/${newPo.id}`);
};

export { default } from "../../frontend/pages/NewPurchaseOrderPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
