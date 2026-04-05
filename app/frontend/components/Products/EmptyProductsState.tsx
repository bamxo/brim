import SyncProductsButton from "../Supplier/SyncProductsButton";

type Props = {
  lastSyncedAt: string | null;
};

export default function EmptyProductsState({ lastSyncedAt }: Props) {
  return (
    <s-section heading="No products synced yet">
      <s-banner
        tone="info"
        heading="Import your Shopify inventory to get started"
      >
        <s-paragraph>
          Syncing pulls your products and current stock levels from Shopify.
          Once synced, you can configure reorder points and assign suppliers
          to automate purchase orders.
        </s-paragraph>
      </s-banner>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
        <SyncProductsButton lastSyncedAt={lastSyncedAt} />
      </div>
    </s-section>
  );
}
