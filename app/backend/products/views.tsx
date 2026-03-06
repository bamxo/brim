import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import { getProductsWithRules, getLastSyncedAt } from "./controller.server";
import { syncProductsForShop } from "./sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const [products, lastSyncedAt] = await Promise.all([
    getProductsWithRules(shop.id),
    getLastSyncedAt(shop.id),
  ]);
  return { products, lastSyncedAt };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  if (formData.get("intent") !== "sync-products") return null;
  const { synced, error } = await syncProductsForShop(admin, shop.id);
  if (error) return { syncResult: { synced: 0, error } };
  return { syncResult: { synced, error: null } };
};

export { default } from "../../frontend/pages/ProductsPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
