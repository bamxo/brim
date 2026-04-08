import { useState, useEffect } from "react";
import { useFetcher, useNavigate } from "react-router";

type SyncResult = { synced: number; error: string | null };
type CreatedPO = { poId: string; poNumber: string; productNames: string[] };
type ReorderResult = { createdPOs: CreatedPO[]; linesAdded: number };

type Props = {
  /** ISO timestamp of the last sync. Updates optimistically after a successful sync. */
  lastSyncedAt: string | null;
  /**
   * The route action that handles intent="sync-products".
   * Defaults to the current page (same route). Pass a path like "/app/products/sync"
   * if the action lives on a different route.
   */
  action?: string;
};

function formatSyncDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SyncProductsButton({ lastSyncedAt, action }: Props) {
  const fetcher = useFetcher<{ syncResult?: SyncResult; reorderResult?: ReorderResult }>();
  const navigate = useNavigate();
  const isSyncing = fetcher.state !== "idle";

  const [displayedSyncedAt, setDisplayedSyncedAt] = useState(lastSyncedAt);

  // Update timestamp optimistically once sync completes without error
  useEffect(() => {
    if (fetcher.data?.syncResult && !fetcher.data.syncResult.error) {
      setDisplayedSyncedAt(new Date().toISOString());
    }
  }, [fetcher.data]);

  // Stay in sync when the loader refreshes the prop
  useEffect(() => {
    setDisplayedSyncedAt(lastSyncedAt);
  }, [lastSyncedAt]);

  const handleSync = () => {
    const fd = new FormData();
    fd.append("intent", "sync-products");
    fetcher.submit(fd, { method: "post", action });
  };

  // Auto-navigate to the PO when a reorder is triggered
  useEffect(() => {
    const pos = fetcher.data?.reorderResult?.createdPOs;
    if (!pos || pos.length === 0) return;

    const productNames = pos.flatMap((po) => po.productNames);
    const summary =
      productNames.length <= 3
        ? productNames.join(", ")
        : `${productNames.slice(0, 3).join(", ")} and ${productNames.length - 3} more`;

    shopify.toast.show(`Reorder triggered — ${summary}`);

    if (pos.length === 1) {
      navigate(`/app/purchase-orders/${pos[0].poId}`);
    } else {
      navigate("/app/purchase-orders");
    }
  }, [fetcher.data, navigate]);

  return (
    <>
      <style>{`
        @keyframes brim-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .brim-spin { animation: brim-spin 0.8s linear infinite; display: inline-block; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <s-button variant="primary" onClick={handleSync} disabled={isSyncing}>
          <span className={isSyncing ? "brim-spin" : ""} style={{ marginRight: 6 }}>
            ↻
          </span>
          {isSyncing ? "Syncing…" : "Sync products"}
        </s-button>
        <span style={{ fontSize: 12, color: "#6d7175" }}>
          {displayedSyncedAt
            ? `Last synced ${formatSyncDate(displayedSyncedAt)}`
            : "Not yet synced"}
        </span>
      </div>

      {fetcher.data?.syncResult?.error && (
        <s-banner tone="critical" heading="Sync failed">
          <s-paragraph>{fetcher.data.syncResult.error}</s-paragraph>
        </s-banner>
      )}
    </>
  );
}
