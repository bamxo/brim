import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Outlet, redirect, useLoaderData, useNavigate, useRouteError } from "react-router";
import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { upsertShop } from "../backend/shops/controller.server";
import {
  getUnreadNotifications,
  markNotificationRead,
  markNotificationDismissed,
} from "../backend/notifications/controller.server";
import type { Notification } from "../backend/notifications/controller.server";
import { getOnboardingStatus } from "../backend/onboarding/controller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await upsertShop(session);

  const url = new URL(request.url);
  const isOnboardingPage = url.pathname === "/app/onboarding";
  const forceOnboarding = process.env.FORCE_ONBOARDING === "true" || url.searchParams.get("force") === "1";

  const status = await getOnboardingStatus(shop.id);

  if ((forceOnboarding || !status.allComplete) && !isOnboardingPage) {
    const dest = forceOnboarding ? "/app/onboarding?force=1" : "/app/onboarding";
    return redirect(dest);
  }

  const notifications = await getUnreadNotifications(shop.id);
  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", notifications };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  void session;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const notificationId = formData.get("notification_id") as string;

  if (intent === "mark-read" && notificationId) {
    const { error } = await markNotificationRead(notificationId);
    if (error) return { error };
    return { readOk: true };
  }

  if (intent === "dismiss" && notificationId) {
    const { error } = await markNotificationDismissed(notificationId);
    if (error) return { error };
    return { dismissedOk: true };
  }

  return { error: "Unknown intent" };
};

export default function AppLayout() {
  const { apiKey, notifications } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">Dashboard</a>
        <a href="/app/purchase-orders">Purchase Orders</a>
        <a href="/app/products">Products</a>
        <a href="/app/suppliers">Suppliers</a>
        <a href="/app/settings">Settings</a>
      </NavMenu>
      <NotificationBanners notifications={notifications} />
      <Outlet />
    </AppProvider>
  );
}

function NotificationBanners({
  notifications,
}: {
  notifications: Notification[];
}) {
  const fetcher = useFetcher();
  const navigate = useNavigate();

  if (notifications.length === 0) return null;

  const handleReview = (n: Notification) => {
    const fd = new FormData();
    fd.append("intent", "mark-read");
    fd.append("notification_id", n.id);
    fetcher.submit(fd, { method: "post" });
    if (n.action_url) navigate(n.action_url);
  };

  const handleDismiss = (n: Notification) => {
    const fd = new FormData();
    fd.append("intent", "dismiss");
    fd.append("notification_id", n.id);
    fetcher.submit(fd, { method: "post" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
      {notifications.map((n) => (
        <s-banner
          key={n.id}
          tone="warning"
          heading={n.title}
          onDismiss={() => handleDismiss(n)}
        >
          <s-paragraph>{n.body}</s-paragraph>
          {n.action_url && (
            <div style={{ marginTop: "8px" }}>
              <s-button variant="primary" onClick={() => handleReview(n)}>
                Review purchase order
              </s-button>
            </div>
          )}
        </s-banner>
      ))}
    </div>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
