import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import { getShopSettings, upsertShopSettings } from "./controller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const settings = await getShopSettings(shop.id);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();

  const { error } = await upsertShopSettings(shop.id, {
    notification_channel: formData.get("notification_channel"),
    default_send_method: formData.get("default_send_method"),
    critical_stock_threshold: Number(formData.get("critical_stock_threshold")),
    supplier_chase_days: Number(formData.get("supplier_chase_days")),
    delivery_reminder_days_before: Number(
      formData.get("delivery_reminder_days_before"),
    ),
  });

  if (error) return { success: false, error };
  return { success: true, error: null };
};

export { default } from "../../frontend/pages/SettingsPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
