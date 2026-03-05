import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useActionData, useLoaderData, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (supabase as any)
    .from("shop_settings")
    .select("*")
    .eq("shop_id", shop.id)
    .single();

  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();

  const payload = {
    shop_id: shop.id,
    notification_channel: formData.get("notification_channel"),
    default_send_method: formData.get("default_send_method"),
    critical_stock_threshold: Number(formData.get("critical_stock_threshold")),
    supplier_chase_days: Number(formData.get("supplier_chase_days")),
    delivery_reminder_days_before: Number(
      formData.get("delivery_reminder_days_before"),
    ),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("shop_settings")
    .upsert(payload, { onConflict: "shop_id" });

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const handleSave = () => {
    const form = document.getElementById("settings-form") as HTMLFormElement;
    if (form) submit(form);
  };

  return (
    <s-page heading="Settings">
      <s-button slot="primary-action" variant="primary" onClick={handleSave}>
        Save
      </s-button>

      {actionData?.success && (
        <s-banner tone="success" heading="Settings saved" />
      )}
      {actionData?.error && (
        <s-banner tone="critical" heading="Failed to save settings">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <form id="settings-form" method="post">
        <s-section heading="Notifications">
          <s-select
            name="notification_channel"
            label="Notification channel"
            value={settings?.notification_channel ?? "email"}
            options={JSON.stringify([
              { label: "Email", value: "email" },
              { label: "Shopify", value: "shopify" },
              { label: "Both", value: "both" },
            ])}
          />
        </s-section>

        <s-section heading="Purchase orders">
          <s-select
            name="default_send_method"
            label="Default send method"
            value={settings?.default_send_method ?? "ask"}
            options={JSON.stringify([
              { label: "Always ask", value: "ask" },
              { label: "Send via Brim", value: "brim" },
              { label: "Copy to clipboard", value: "clipboard" },
              { label: "Send via Gmail (coming soon)", value: "gmail", disabled: true },
            ])}
          />
        </s-section>

        <s-section heading="Reorder thresholds">
          <s-text-field
            name="critical_stock_threshold"
            label="Critical stock threshold"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={String(settings?.critical_stock_threshold ?? "0.5")}
            help-text="Fraction of the reorder point at which a critical-low alert fires (e.g. 0.5 = 50%)"
          />
          <s-text-field
            name="supplier_chase_days"
            label="Chase supplier after (days)"
            type="number"
            min="1"
            value={String(settings?.supplier_chase_days ?? "3")}
            help-text="Days after sending a PO before Brim reminds you to follow up"
          />
          <s-text-field
            name="delivery_reminder_days_before"
            label="Delivery reminder (days before)"
            type="number"
            min="0"
            value={String(settings?.delivery_reminder_days_before ?? "1")}
            help-text="Days before expected delivery to send a receipt confirmation reminder"
          />
        </s-section>
      </form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
