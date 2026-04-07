import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import {
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  getCustomItemsBySupplier,
  createCustomItem,
  updateCustomItem,
  deleteCustomItem,
} from "./controller.server";
import {
  getProductsBySupplier,
  getAllProductsForShop,
  getLastSyncedAt,
  upsertReorderRule,
  deactivateReorderRule,
  updateProductSku,
} from "../products/controller.server";
import { syncProductsForShop } from "../products/sync.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const [supplier, assignedProducts, allProducts, lastSyncedAt, customItems] =
    await Promise.all([
      getSupplierById(shop.id, params.id!),
      getProductsBySupplier(shop.id, params.id!),
      getAllProductsForShop(shop.id),
      getLastSyncedAt(shop.id),
      getCustomItemsBySupplier(shop.id, params.id!),
    ]);

  if (!supplier) throw new Response("Supplier not found", { status: 404 });

  return { supplier, assignedProducts, allProducts, lastSyncedAt, customItems };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // ── Delete supplier ──────────────────────────────────────────────
  if (intent === "delete") {
    const { error } = await deleteSupplier(shop.id, params.id!);
    if (error) return { errors: { form: error } };
    return redirect("/app/suppliers");
  }

  // ── Sync products in-place (no navigation) ───────────────────────
  if (intent === "sync-products") {
    const { synced, error } = await syncProductsForShop(admin, shop.id);
    if (error) return { syncResult: { synced: 0, error } };
    return { syncResult: { synced, error: null } };
  }

  // ── Assign a product to this supplier ────────────────────────────
  if (intent === "add-product") {
    const productId = String(formData.get("product_id"));
    const rawCost = formData.get("unit_cost");
    const unitCost = rawCost ? parseFloat(String(rawCost)) : null;
    const sku = String(formData.get("sku") ?? "").trim() || null;

    const [ruleResult, skuResult] = await Promise.all([
      upsertReorderRule({
        shop_id: shop.id,
        product_id: productId,
        primary_supplier_id: params.id!,
        backup_supplier_id: null,
        reorder_point: 0,
        reorder_quantity: 1,
        unit_cost: unitCost,
        is_active: true,
      }),
      sku ? updateProductSku(shop.id, productId, sku) : Promise.resolve({ error: null }),
    ]);

    if (ruleResult.error) return { productError: ruleResult.error };
    if (skuResult.error) return { productError: skuResult.error };
    return { productOk: true };
  }

  // ── Remove a product from this supplier ──────────────────────────
  if (intent === "remove-product") {
    const productId = String(formData.get("product_id"));
    const { error } = await deactivateReorderRule(shop.id, productId);
    if (error) return { productError: error };
    return { productOk: true };
  }

  // ── Add custom catalog item ──────────────────────────────────────
  if (intent === "add-custom-item") {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { customItemError: "Product name is required" };
    const sku = String(formData.get("sku") ?? "").trim() || null;
    const rawCost = formData.get("unit_cost");
    const unitCost = rawCost ? parseFloat(String(rawCost)) : null;
    const { error } = await createCustomItem(shop.id, params.id!, {
      name,
      sku,
      unit_cost: unitCost,
    });
    if (error) return { customItemError: error };
    return { customItemOk: true };
  }

  // ── Edit custom catalog item ─────────────────────────────────────
  if (intent === "edit-custom-item") {
    const itemId = String(formData.get("item_id"));
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { customItemError: "Product name is required" };
    const sku = String(formData.get("sku") ?? "").trim() || null;
    const rawCost = formData.get("unit_cost");
    const unitCost = rawCost ? parseFloat(String(rawCost)) : null;
    const { error } = await updateCustomItem(shop.id, itemId, {
      name,
      sku,
      unit_cost: unitCost,
    });
    if (error) return { customItemError: error };
    return { customItemOk: true };
  }

  // ── Remove custom catalog item ───────────────────────────────────
  if (intent === "remove-custom-item") {
    const itemId = String(formData.get("item_id"));
    const { error } = await deleteCustomItem(shop.id, itemId);
    if (error) return { customItemError: error };
    return { customItemOk: true };
  }

  // ── Unknown intent ──────────────────────────────────────────────
  if (intent) return { errors: { form: `Unknown action: ${intent}` } };

  // ── Update supplier info ─────────────────────────────────────────
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { errors: { name: "Name is required" } };
  if (!email) return { errors: { email: "Email is required" } };

  const { error } = await updateSupplier(shop.id, params.id!, {
    name,
    email,
    phone,
    notes,
  });

  if (error) return { errors: { form: error } };
  return { errors: {}, success: true };
};

export { default } from "../../frontend/pages/SupplierDetailPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
