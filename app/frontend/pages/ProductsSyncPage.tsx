import { useActionData, useNavigation } from "react-router";

type ActionData = { synced?: number; error?: string };

export default function ProductsSyncPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSyncing = navigation.state === "submitting";

  return (
    <s-page heading="Sync products from Shopify">
      {actionData?.error && (
        <s-banner tone="critical" heading="Sync failed">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-paragraph>
          This will import all products and variants from your Shopify store
          into Brim. Existing products will be updated with current stock
          levels. This may take a moment for large catalogues.
        </s-paragraph>
        <form method="post">
          <s-button
            variant="primary"
            type="submit"
            {...(isSyncing ? { loading: true } : {})}
          >
            {isSyncing ? "Syncing…" : "Start sync"}
          </s-button>
        </form>
      </s-section>
    </s-page>
  );
}
