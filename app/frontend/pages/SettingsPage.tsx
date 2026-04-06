import { useActionData, useLoaderData, useSubmit } from "react-router";
import TitleBar from "../components/Header/TitleBar";

type Settings = {
  notification_channel: string | null;
  default_send_method: string | null;
  critical_stock_threshold: number | null;
  supplier_chase_days: number | null;
  delivery_reminder_days_before: number | null;
} | null;

type LoaderData = { settings: Settings };
type ActionData = { success?: boolean; error?: string | null };

export default function SettingsPage() {
  const { settings } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();

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
            <s-option value="ask">Always ask</s-option>
            <s-option value="brim">Send via Brim</s-option>
            <s-option value="clipboard">Copy to clipboard</s-option>
            <s-option value="gmail" disabled>Send via Gmail (coming soon)</s-option>
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
