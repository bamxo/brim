import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import {
  getProductByShopifyId,
  getReorderRuleForProduct,
  upsertReorderRule,
  deleteReorderRule,
} from "./controller.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const product = await getProductByShopifyId(shop.id, params.id!);
  if (!product) {
    return corsJson({ notSynced: true });
  }

  const rule = await getReorderRuleForProduct(shop.id, product.id);
  return corsJson({ rule });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const product = await getProductByShopifyId(shop.id, params.id!);
  if (!product) {
    return corsJson({ success: false, errors: { form: "Product not synced to Brim" } });
  }

  const body = await request.json();
  const intent = body.intent;

  if (intent === "clear-rule") {
    const { error } = await deleteReorderRule(shop.id, product.id);
    if (error) return corsJson({ success: false, errors: { form: error } });
    return corsJson({ success: true, errors: {} });
  }

  const reorderPoint = Number(body.reorder_point);
  const reorderQuantity = Number(body.reorder_quantity);
  const primarySupplierId = body.primary_supplier_id as string | null;
  const unitCost = body.unit_cost != null && body.unit_cost !== "" ? Number(body.unit_cost) : null;

  if (isNaN(reorderPoint) || reorderPoint < 0)
    return corsJson({ success: false, errors: { reorder_point: "Reorder point must be 0 or greater" } });
  if (!reorderQuantity || reorderQuantity <= 0)
    return corsJson({ success: false, errors: { reorder_quantity: "Reorder quantity must be greater than 0" } });
  if (!primarySupplierId)
    return corsJson({ success: false, errors: { primary_supplier_id: "A primary supplier is required" } });

  const { error } = await upsertReorderRule({
    shop_id: shop.id,
    product_id: product.id,
    primary_supplier_id: primarySupplierId,
    backup_supplier_id: null,
    reorder_point: reorderPoint,
    reorder_quantity: reorderQuantity,
    unit_cost: unitCost,
    is_active: true,
  });

  if (error) return corsJson({ success: false, errors: { form: error } });
  return corsJson({ success: true, errors: {} });
};
