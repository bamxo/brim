import { useState, useEffect, useCallback, useRef } from "react";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "react-router";
import TitleBar from "../components/Header/TitleBar";

type LineItem = {
  id: string;
  product_id?: string;
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  shopify_variant_id?: string;
  quantity_ordered: number;
  unit_cost: number | null;
  line_total: number | null;
  status: string;
};

type SupplierProduct = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  shopify_variant_id: string;
  unit_cost: number | null;
};

type LoaderData = {
  po: {
    id: string;
    po_number: string;
    status: string;
    currency: string;
    total_amount: number;
    notes: string | null;
    confirmed_delivery_date: string | null;
    suppliers: { id: string; name: string; email: string; phone: string | null } | null;
    purchase_order_line_items: LineItem[];
  };
  pdfDataUrl: string | null;
  supplierProducts: SupplierProduct[];
};

type ActionData = {
  success?: boolean;
  error?: string | null;
  removedLine?: LineItem | null;
};

function productLabel(p: SupplierProduct): string {
  let label = p.title;
  if (p.variant_title) label += ` — ${p.variant_title}`;
  if (p.sku) label += ` (${p.sku})`;
  return label;
}

export default function PurchaseOrderDetailPage() {
  const { po, pdfDataUrl, supplierProducts } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const isDraft = po.status === "draft";
  const [pdfExpanded, setPdfExpanded] = useState(false);

  // Product search state
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<LineItem | null>(null);
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null);

  // Undo banner state
  const [undoItem, setUndoItem] = useState<LineItem | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateDropdownPos = useCallback(() => {
    const el = document.getElementById("detail-product-search-container");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
  }, []);

  // Product search input listeners
  useEffect(() => {
    const el = document.getElementById("detail-product-search") as
      | (HTMLElement & { value: string })
      | null;
    if (!el) return;

    const onInput = () => {
      setProductSearch((el as HTMLElement & { value: string }).value);
      updateDropdownPos();
      setShowProductDropdown(true);
    };
    const onFocus = () => {
      updateDropdownPos();
      setShowProductDropdown(true);
    };

    el.addEventListener("input", onInput);
    el.addEventListener("focus", onFocus);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("focus", onFocus);
    };
  }, [updateDropdownPos]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const container = document.getElementById("detail-product-search-container");
      const dropdown = document.getElementById("detail-product-dropdown");
      const target = e.target as Node;
      if (
        container && !container.contains(target) &&
        (!dropdown || !dropdown.contains(target))
      ) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handleAddProduct = useCallback(
    (product: SupplierProduct) => {
      const fd = new FormData();
      fd.append("intent", "add-line-item");
      fd.append("product_id", product.id);
      fd.append("shopify_variant_id", product.shopify_variant_id);
      fd.append("product_name", product.title);
      if (product.variant_title) fd.append("variant_title", product.variant_title);
      if (product.sku) fd.append("sku", product.sku);
      if (product.unit_cost != null) fd.append("unit_cost", String(product.unit_cost));
      submit(fd, { method: "post" });

      setProductSearch("");
      setShowProductDropdown(false);
      const el = document.getElementById("detail-product-search") as
        | (HTMLElement & { value: string })
        | null;
      if (el) el.value = "";
    },
    [submit],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const removedItem = deleteTarget;
    setDeleteTarget(null);

    const fd = new FormData();
    fd.append("intent", "remove-line-item");
    fd.append("line_item_id", removedItem.id);
    submit(fd, { method: "post" });

    // Show undo banner
    setUndoItem(removedItem);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setUndoItem(null);
    }, 15000);
  }, [deleteTarget, submit]);

  const handleUndo = useCallback(() => {
    if (!undoItem) return;
    const item = undoItem;
    setUndoItem(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const fd = new FormData();
    fd.append("intent", "add-line-item");
    fd.append("product_id", item.product_id ?? "");
    fd.append("shopify_variant_id", item.shopify_variant_id ?? "");
    fd.append("product_name", item.product_name);
    if (item.variant_title) fd.append("variant_title", item.variant_title);
    if (item.sku) fd.append("sku", item.sku);
    if (item.unit_cost != null) fd.append("unit_cost", String(item.unit_cost));
    submit(fd, { method: "post" });
  }, [undoItem, submit]);

  const handleDownloadPdf = () => {
    if (!pdfDataUrl) return;
    const a = document.createElement("a");
    a.href = pdfDataUrl;
    a.download = `${po.po_number}.pdf`;
    a.click();
  };

  const handleSend = (sendMethod: string) => {
    const fd = new FormData();
    fd.append("intent", "mark-sent");
    fd.append("send_method", sendMethod);
    submit(fd, { method: "post" });
  };

  const handleDismiss = () => {
    if (!confirm("Dismiss this purchase order?")) return;
    const fd = new FormData();
    fd.append("intent", "dismiss");
    submit(fd, { method: "post" });
  };

  // Filter products: exclude those already on the PO
  const existingProductIds = new Set(
    po.purchase_order_line_items.map((li) => li.product_id).filter(Boolean),
  );
  const availableProducts = (supplierProducts ?? []).filter(
    (p) => !existingProductIds.has(p.id),
  );
  const filteredProducts = availableProducts.filter((p) => {
    if (!productSearch) return true;
    return productLabel(p).toLowerCase().includes(productSearch.toLowerCase());
  });

  return (
    <TitleBar heading={po.po_number} breadcrumbs={[{ label: "Purchase Orders", href: "/app/purchase-orders" }]}>
      {isDraft && (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => handleSend("brim")}
        >
          Send via Brim
        </s-button>
      )}
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/purchase-orders")}
      >
        Back
      </s-button>
      {actionData?.error && (
        <s-banner tone="critical" heading="Error">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      {/* Undo banner */}
      {undoItem && (
        <s-banner tone="info" heading="Product removed">
          <s-paragraph>
            {undoItem.product_name}
            {undoItem.variant_title ? ` — ${undoItem.variant_title}` : ""} was
            removed.
          </s-paragraph>
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "8px",
            }}
          >
            <s-button onClick={handleUndo}>Undo</s-button>
            <s-button
              onClick={() => {
                setUndoItem(null);
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
              }}
            >
              Dismiss
            </s-button>
          </div>
        </s-banner>
      )}

      <s-section heading="Order details" slot="aside">
        <s-paragraph>
          <s-text>Supplier: </s-text>
          <s-text>{po.suppliers?.name ?? "—"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Supplier email: </s-text>
          <s-text>{po.suppliers?.email ?? "—"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Status: </s-text>
          <s-text>{po.status}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Total: </s-text>
          <s-text>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: po.currency,
            }).format(po.total_amount)}
          </s-text>
        </s-paragraph>
        {po.confirmed_delivery_date && (
          <s-paragraph>
            <s-text>Delivery date: </s-text>
            <s-text>
              {new Date(po.confirmed_delivery_date).toLocaleDateString()}
            </s-text>
          </s-paragraph>
        )}
        {po.notes && (
          <s-paragraph>
            <s-text>Notes: </s-text>
            <s-text>{po.notes}</s-text>
          </s-paragraph>
        )}
      </s-section>

      <s-section heading="Line items">
        {/* Product search (draft only) */}
        {isDraft && (
          <div
            id="detail-product-search-container"
            style={{ position: "relative", marginBottom: "16px" }}
          >
            <s-text-field
              id="detail-product-search"
              label="Search and add products"
              placeholder="Search by name, SKU, or variant"
              value={productSearch}
              autocomplete="off"
            />
          </div>
        )}

        <s-table>
          <s-table-header-row>
            <s-table-header>Product</s-table-header>
            <s-table-header>SKU</s-table-header>
            <s-table-header>Qty</s-table-header>
            <s-table-header>Unit cost</s-table-header>
            <s-table-header>Line total</s-table-header>
            {isDraft && <s-table-header></s-table-header>}
          </s-table-header-row>
          <s-table-body>
            {po.purchase_order_line_items.map((line) => (
              <s-table-row key={line.id}>
                <s-table-cell>
                  {line.product_name}
                  {line.variant_title ? ` — ${line.variant_title}` : ""}
                </s-table-cell>
                <s-table-cell>{line.sku ?? "—"}</s-table-cell>
                <s-table-cell>
                  {isDraft ? (
                    <s-number-field
                      name={`qty-${line.id}`}
                      label="Quantity"
                      label-hidden
                      min={0}
                      value={String(line.quantity_ordered)}
                    />
                  ) : (
                    String(line.quantity_ordered)
                  )}
                </s-table-cell>
                <s-table-cell>
                  {line.unit_cost != null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: po.currency,
                      }).format(line.unit_cost)
                    : "—"}
                </s-table-cell>
                <s-table-cell>
                  {line.line_total != null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: po.currency,
                      }).format(line.line_total)
                    : "—"}
                </s-table-cell>
                {isDraft && (
                  <s-table-cell>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                      }}
                    >
                      <span
                        onClick={() => setDeleteTarget(line)}
                        onMouseOver={() => setHoveredDeleteId(line.id)}
                        onMouseOut={() => setHoveredDeleteId(null)}
                        style={{
                          cursor: "pointer",
                          padding: "6px",
                          lineHeight: 1,
                        }}
                      >
                        <s-icon
                          type="delete"
                          {...(hoveredDeleteId === line.id
                            ? { tone: "critical" }
                            : { color: "subdued" })}
                        />
                      </span>
                    </div>
                  </s-table-cell>
                )}
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
        {isDraft && (
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={() => {
                const fd = new FormData();
                fd.append("intent", "update-quantities");
                for (const line of po.purchase_order_line_items) {
                  fd.append("line_id", line.id);
                  const input = document.querySelector<HTMLInputElement>(
                    `[name="qty-${line.id}"]`,
                  );
                  fd.append("quantity", input?.value ?? String(line.quantity_ordered));
                }
                submit(fd, { method: "post" });
              }}
            >
              Update quantities
            </s-button>
          </s-stack>
        )}
      </s-section>

      {pdfDataUrl && (
        <s-section heading="Document">
          {!pdfExpanded ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "4px 0",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "52px",
                  border: "1px solid #d9d9d9",
                  borderRadius: "4px",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#fff",
                }}
              >
                <iframe
                  src={pdfDataUrl}
                  style={{
                    width: "612px",
                    height: "792px",
                    transform: "scale(0.065)",
                    transformOrigin: "top left",
                    border: "none",
                    pointerEvents: "none",
                  }}
                  tabIndex={-1}
                  title="PDF thumbnail"
                />
              </div>
              <span style={{ flex: 1, fontSize: "13px", fontWeight: 500 }}>
                PDF Preview
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <s-button onClick={() => setPdfExpanded(true)}>
                  Expand
                </s-button>
                <s-button onClick={handleDownloadPdf}>
                  Download
                </s-button>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <s-button onClick={() => setPdfExpanded(false)}>
                  Collapse
                </s-button>
                <s-button onClick={handleDownloadPdf}>
                  Download
                </s-button>
              </div>
              <iframe
                src={pdfDataUrl}
                style={{
                  width: "100%",
                  height: "800px",
                  border: "1px solid #e1e3e5",
                  borderRadius: "8px",
                }}
                title={`PDF preview for ${po.po_number}`}
              />
            </>
          )}
        </s-section>
      )}

      {isDraft && (
        <s-section heading="Send this order" slot="aside">
          <s-paragraph>
            Choose how to send this purchase order to{" "}
            {po.suppliers?.name ?? "your supplier"}.
          </s-paragraph>
          <s-stack direction="block" gap="base">
            <s-button variant="primary" onClick={() => handleSend("brim")}>
              Send via Brim email
            </s-button>
            <s-button onClick={() => handleSend("clipboard")}>
              Copy to clipboard
            </s-button>
            <s-button disabled>
              Send via Gmail (coming soon)
            </s-button>
          </s-stack>
          <s-divider />
          <s-button tone="critical" onClick={handleDismiss}>
            Dismiss order
          </s-button>
        </s-section>
      )}

      {/* Product search dropdown */}
      {showProductDropdown && isDraft && (
        <div
          id="detail-product-dropdown"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            background: "#fff",
            border: "1px solid #e1e3e5",
            borderRadius: "0 0 8px 8px",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          {filteredProducts.length > 0 ? (
            filteredProducts.map((p) => (
              <div
                key={p.id}
                onMouseDown={() => handleAddProduct(p)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f1f1f1",
                  fontSize: "14px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#f6f6f7";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#fff";
                }}
              >
                {productLabel(p)}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "12px",
                fontSize: "13px",
                color: "#6d7175",
                textAlign: "center",
              }}
            >
              No products available to add
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "12px" }}>
              Remove product?
            </div>
            <div style={{ fontSize: "14px", color: "#6d7175", marginBottom: "20px" }}>
              Are you sure you want to remove{" "}
              <strong style={{ color: "#202223" }}>
                {deleteTarget.product_name}
                {deleteTarget.variant_title
                  ? ` — ${deleteTarget.variant_title}`
                  : ""}
              </strong>{" "}
              from this purchase order?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <s-button onClick={() => setDeleteTarget(null)}>Cancel</s-button>
              <s-button tone="critical" onClick={handleConfirmDelete}>
                Remove
              </s-button>
            </div>
          </div>
        </div>
      )}
    </TitleBar>
  );
}
