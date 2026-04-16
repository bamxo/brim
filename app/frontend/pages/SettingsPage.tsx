import { useActionData, useLoaderData, useSearchParams, useSubmit, useRevalidator } from "react-router";
import { useEffect } from "react";
import TitleBar from "../components/Header/TitleBar";

type Settings = {
  notification_channel: string | null;
  default_send_method: string | null;
  reorder_behavior: string | null;
  critical_stock_threshold: number | null;
  supplier_chase_days: number | null;
  delivery_reminder_days_before: number | null;
} | null;

type GoogleAccount = {
  email: string;
  connectedAt: string;
  isDisconnected: boolean;
} | null;

type LoaderData = { settings: Settings; google: GoogleAccount; shopId: string };
type ActionData = { success?: boolean; error?: string | null; googleDisconnected?: boolean };

export default function SettingsPage() {
  const { settings, google, shopId } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const googleConnected = searchParams.get("google_connected") === "1";

  const { revalidate } = useRevalidator();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "gmail_connected") revalidate();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [revalidate]);

  const handleConnectGmail = () => {
    // Must open outside the Shopify iframe — Google blocks OAuth in iframes
    // Pass shop_id so the new tab doesn't need a Shopify session
    window.open(
      `${window.location.origin}/auth/google/start?shop_id=${shopId}`,
      "_blank",
    );
  };
  const googleDisconnected = searchParams.get("google_disconnected") === "1";
  const googleError = searchParams.get("google_error");

  const handleSave = () => {
    const form = document.getElementById("settings-form") as HTMLFormElement;
    if (form) submit(form);
  };

  return (
    <TitleBar heading="Settings">
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
      {googleConnected && (
        <s-banner tone="success" heading="Gmail connected" />
      )}
      {(googleDisconnected || actionData?.googleDisconnected) && (
        <s-banner tone="info" heading="Gmail disconnected" />
      )}
      {googleError && (
        <s-banner tone="critical" heading="Gmail connection failed">
          <s-paragraph>{googleError}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Gmail connection">
        {google && !google.isDisconnected ? (
          <>
            <s-paragraph>
              Connected as <strong>{google.email}</strong>. Purchase orders sent by email
              will come from this address.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <form method="post">
                <input type="hidden" name="intent" value="disconnect-gmail" />
                <s-button type="submit" variant="secondary" tone="critical">
                  Disconnect
                </s-button>
              </form>
              <s-button variant="secondary" onClick={handleConnectGmail}>
                Switch account
              </s-button>
            </s-stack>
          </>
        ) : (
          <>
            <s-paragraph>
              Connect a Gmail account to send purchase orders from your own email address
              and track supplier replies inside Brim.
            </s-paragraph>
            <s-button variant="primary" onClick={handleConnectGmail}>
              Connect Gmail
            </s-button>
          </>
        )}
      </s-section>

      <form id="settings-form" method="post">
        <s-section heading="Notifications">
          <s-select
            name="notification_channel"
            label="Notification channel"
            value={settings?.notification_channel ?? "email"}
          >
            <s-option value="email">Email</s-option>
            <s-option value="shopify">Shopify</s-option>
            <s-option value="both">Both</s-option>
          </s-select>
        </s-section>

        <s-section heading="Purchase orders">
          <s-select
            name="default_send_method"
            label="Default send method"
            value={settings?.default_send_method ?? "ask"}
          >
            <s-option value="ask">Ask me every time</s-option>
            <s-option value="gmail">Send via Gmail</s-option>
            <s-option value="clipboard">Copy to clipboard</s-option>
          </s-select>
        </s-section>

        <s-section heading="Reorder behavior">
          <s-select
            name="reorder_behavior"
            label="When stock hits the reorder point"
            value={settings?.reorder_behavior ?? "ask_every_time"}
            help-text="Controls what happens when a product's stock drops to or below its reorder point"
          >
            <s-option value="ask_every_time">Ask me every time</s-option>
            <s-option value="auto_create" disabled>Automatically create draft PO (coming soon)</s-option>
            <s-option value="auto_send" disabled>Automatically send PO to supplier (coming soon)</s-option>
          </s-select>
        </s-section>

        <s-section heading="Reorder thresholds">
          <s-number-field
            name="critical_stock_threshold"
            label="Critical stock threshold"
            min={0}
            max={1}
            step={0.05}
            value={String(settings?.critical_stock_threshold ?? "0.5")}
            help-text="Fraction of the reorder point at which a critical-low alert fires (e.g. 0.5 = 50%)"
          />
          <s-number-field
            name="supplier_chase_days"
            label="Chase supplier after (days)"
            min={1}
            value={String(settings?.supplier_chase_days ?? "3")}
            help-text="Days after sending a PO before Brim reminds you to follow up"
          />
          <s-number-field
            name="delivery_reminder_days_before"
            label="Delivery reminder (days before)"
            min={0}
            value={String(settings?.delivery_reminder_days_before ?? "1")}
            help-text="Days before expected delivery to send a receipt confirmation reminder"
          />
        </s-section>
      </form>
    </TitleBar>
  );
}
