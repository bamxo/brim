import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import {
  getProductById,
  getReorderRuleForProduct,
  upsertReorderRule,
  deleteReorderRule,
  updateProductSku,
} from "./controller.server";
import { getActiveSuppliersMinimal } from "../suppliers/controller.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const product = await getProductById(shop.id, params.id!);
  if (!product) throw new Response("Product not found", { status: 404 });

  const rule = await getReorderRuleForProduct(shop.id, params.id!);
  const suppliers = await getActiveSuppliersMinimal(shop.id);

  return { product, rule, suppliers };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "clear-rule") {
    const { error } = await deleteReorderRule(shop.id, params.id);
    if (error) return { errors: { form: error }, success: false };
    return { success: true, deleted: true, errors: {} };
  }

  const reorderPoint = Number(formData.get("reorder_point"));
  const reorderQuantity = Number(formData.get("reorder_quantity"));
  const primarySupplierId = formData.get("primary_supplier_id") as string | null;
  const unitCost = formData.get("unit_cost") ? Number(formData.get("unit_cost")) : null;
  const sku = String(formData.get("sku") ?? "").trim() || null;

  if (!reorderPoint || reorderPoint < 0)
    return { errors: { reorder_point: "Reorder point must be a positive number" }, success: false };
  if (!reorderQuantity || reorderQuantity <= 0)
    return { errors: { reorder_quantity: "Reorder quantity must be greater than 0" }, success: false };
  if (!primarySupplierId)
    return { errors: { primary_supplier_id: "A primary supplier is required" }, success: false };

  const [ruleResult, skuResult] = await Promise.all([
    upsertReorderRule({
      shop_id: shop.id,
      product_id: params.id,
      primary_supplier_id: primarySupplierId,
      backup_supplier_id: null,
      reorder_point: reorderPoint,
      reorder_quantity: reorderQuantity,
      unit_cost: unitCost,
      is_active: true,
    }),
    updateProductSku(shop.id, params.id!, sku),
  ]);

  if (ruleResult.error) return { errors: { form: ruleResult.error }, success: false };
  if (skuResult.error) return { errors: { form: skuResult.error }, success: false };
  return { success: true, deleted: false, errors: {} };
};

export { default } from "../../frontend/pages/ProductDetailPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
