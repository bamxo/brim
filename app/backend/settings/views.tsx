import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import {
  createOAuthClient,
  decryptAccountTokens,
  deleteGoogleAccount,
  getGoogleAccount,
} from "../google/oauth.server";
import { ensureWatch, stopWatch } from "../google/pubsub.server";
import { getShopSettings, upsertShopSettings } from "./controller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const [settings, googleAccount] = await Promise.all([
    getShopSettings(shop.id),
    getGoogleAccount(shop.id),
  ]);
  if (googleAccount && !googleAccount.is_disconnected) {
    void ensureWatch(shop.id);
  }
  const google = googleAccount
    ? {
        email: googleAccount.google_email,
        connectedAt: googleAccount.connected_at,
        isDisconnected: googleAccount.is_disconnected,
      }
    : null;
  return { settings, google, shopId: shop.id };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "disconnect-gmail") {
    const account = await getGoogleAccount(shop.id);
    if (account) {
      try { await stopWatch(shop.id); } catch {}
      try {
        const { refreshToken } = decryptAccountTokens(account);
        await createOAuthClient().revokeToken(refreshToken);
      } catch {}
      await deleteGoogleAccount(shop.id);
    }
    return { success: true, error: null, googleDisconnected: true };
  }

  const criticalStockThreshold = Number(formData.get("critical_stock_threshold"));
  const supplierChaseDays = Number(formData.get("supplier_chase_days"));
  const deliveryReminderDaysBefore = Number(formData.get("delivery_reminder_days_before"));

  if (isNaN(criticalStockThreshold) || criticalStockThreshold < 0)
    return { success: false, error: "Critical stock threshold must be 0 or greater" };
  if (isNaN(supplierChaseDays) || supplierChaseDays < 0)
    return { success: false, error: "Supplier chase days must be 0 or greater" };
  if (isNaN(deliveryReminderDaysBefore) || deliveryReminderDaysBefore < 0)
    return { success: false, error: "Delivery reminder days must be 0 or greater" };

  const { error } = await upsertShopSettings(shop.id, {
    notification_channel: formData.get("notification_channel"),
    default_send_method: formData.get("default_send_method"),
    reorder_behavior: formData.get("reorder_behavior"),
    critical_stock_threshold: criticalStockThreshold,
    supplier_chase_days: supplierChaseDays,
    delivery_reminder_days_before: deliveryReminderDaysBefore,
  });

  if (error) return { success: false, error };
  return { success: true, error: null };
};

export { default } from "../../frontend/pages/SettingsPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
