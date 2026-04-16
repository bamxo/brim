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
  image_url?: string | null;
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
    gmail_thread_id: string | null;
    gmail_account_email: string | null;
    suppliers: { id: string; name: string; email: string; phone: string | null } | null;
    purchase_order_line_items: LineItem[];
  };
  pdfDataUrl: string | null;
  supplierProducts: SupplierProduct[];
  gmail: { email: string } | null;
  thread: {
    threadId: string;
    messages: {
      id: string;
      from: string;
      to: string;
      date: string | null;
      subject: string;
      snippet: string;
      bodyHtml: string | null;
      bodyText: string | null;
    }[];
  } | null;
  emailDraft: { subject: string; body: string } | null;
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
  const { po, pdfDataUrl, supplierProducts, gmail, thread, emailDraft } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const isDraft = po.status === "draft";
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Email compose state — pre-populated from server-rendered draft
  const [emailSubject, setEmailSubject] = useState(emailDraft?.subject ?? "");
  const [emailBody, setEmailBody] = useState(emailDraft?.body ?? "");

  // Keep in sync when loader data refreshes (e.g. line items changed)
  useEffect(() => {
    if (emailDraft?.subject) setEmailSubject(emailDraft.subject);
    if (emailDraft?.body) setEmailBody(emailDraft.body);
  }, [emailDraft?.subject, emailDraft?.body]);

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
    if (sendMethod === "gmail") {
      fd.append("email_subject", emailSubject);
      fd.append("email_body", emailBody);
    }
    submit(fd, { method: "post" });
  };

  const handleDismiss = () => {
    if (!confirm("Dismiss this purchase order?")) return;
    const fd = new FormData();
    fd.append("intent", "dismiss");
    submit(fd, { method: "post" });
  };

  const [replyBody, setReplyBody] = useState("");
  const handleSendReply = () => {
    if (!replyBody.trim()) return;
    const fd = new FormData();
    fd.append("intent", "gmail-reply");
    fd.append("body", replyBody);
    submit(fd, { method: "post" });
    setReplyBody("");
  };

  const handleMarkReceived = () => {
    const fd = new FormData();
    fd.append("intent", "mark-received");
    submit(fd, { method: "post" });
  };

  const handleCancelOrder = () => {
    if (!confirm("Are you sure you want to cancel this purchase order?")) return;
    const fd = new FormData();
    fd.append("intent", "cancel-order");
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

  const statusColors: Record<string, { bg: string; color: string }> = {
    draft: { bg: "#f3f4f6", color: "#6b7280" },
    sent: { bg: "#dbeafe", color: "#1d4ed8" },
    received: { bg: "#d1fae5", color: "#065f46" },
    cancelled: { bg: "#fee2e2", color: "#b91c1c" },
  };
  const statusStyle = statusColors[po.status] ?? { bg: "#f3f4f6", color: "#374151" };

  return (
    <TitleBar heading={po.po_number} breadcrumbs={[{ label: "Purchase Orders", href: "/app/purchase-orders" }]}>
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

      {undoItem && (
        <s-banner tone="info" heading="Product removed">
          <s-paragraph>
            {undoItem.product_name}
            {undoItem.variant_title ? ` — ${undoItem.variant_title}` : ""} was removed.
          </s-paragraph>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
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

      {/* ── Sidebar ── */}
      <div slot="aside" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Summary card */}
        <s-section heading="Summary">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "2px" }}>Supplier</div>
              <div style={{ fontSize: "14px", fontWeight: 500, color: "#202223" }}>{po.suppliers?.name ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "2px" }}>Supplier email</div>
              <div style={{ fontSize: "14px", color: "#202223" }}>{po.suppliers?.email ?? "—"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "12px", color: "#6d7175" }}>Status</div>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 10px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  textTransform: "capitalize",
                }}
              >
                {po.status}
              </span>
            </div>
            {po.confirmed_delivery_date && (
              <div>
                <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "2px" }}>Delivery date</div>
                <div style={{ fontSize: "14px", color: "#202223" }}>
                  {new Date(po.confirmed_delivery_date).toLocaleDateString()}
                </div>
              </div>
            )}
            {po.notes && (
              <div>
                <div style={{ fontSize: "12px", color: "#6d7175", marginBottom: "2px" }}>Notes</div>
                <div style={{ fontSize: "13px", color: "#202223" }}>{po.notes}</div>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "8px",
                borderTop: "1px solid #e1e3e5",
                marginTop: "4px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#202223" }}>Total:</span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#202223" }}>
                {new Intl.NumberFormat("en-US", { style: "currency", currency: po.currency }).format(po.total_amount)}
              </span>
            </div>
          </div>
        </s-section>

        {/* Actions card — shown for non-draft orders */}
        {!isDraft && po.status !== "received" && po.status !== "cancelled" && (
          <s-section heading="Actions">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {po.status === "sent" && (
                <s-button variant="primary" onClick={handleMarkReceived}>
                  Mark as received
                </s-button>
              )}
              <s-button tone="critical" onClick={handleCancelOrder}>
                Cancel order
              </s-button>
            </div>
          </s-section>
        )}

        {/* PDF Preview card */}
        {pdfDataUrl && (
          <s-section heading="PDF Preview">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Clickable thumbnail */}
              <div
                onClick={() => setPdfModalOpen(true)}
                style={{
                  position: "relative",
                  width: "70%",
                  paddingBottom: "90.6%", /* 129.4% × 0.7 — smaller thumbnail */
                  border: "1px solid #e1e3e5",
                  borderRadius: "6px",
                  overflow: "hidden",
                  background: "#fff",
                  cursor: "pointer",
                  margin: "0 auto",
                }}
                title="Click to view full PDF"
              >
                <iframe
                  src={pdfDataUrl}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                    pointerEvents: "none",
                  }}
                  tabIndex={-1}
                  title="PDF thumbnail"
                />
                {/* Hover overlay hint */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0)",
                    transition: "background 0.15s",
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.08)"; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0)"; }}
                />
              </div>
              <s-button onClick={handleDownloadPdf}>Download</s-button>
            </div>
          </s-section>
        )}
        
        {/* PDF modal */}
        {pdfDataUrl && pdfModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
              padding: "24px",
            }}
            onClick={() => setPdfModalOpen(false)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                overflow: "hidden",
                width: "min(920px, 95vw)",
                maxHeight: "95vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 20px",
                  borderBottom: "1px solid #e1e3e5",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#202223" }}>
                  {po.po_number}.pdf
                </span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <s-button onClick={handleDownloadPdf}>Download</s-button>
                  <button
                    onClick={() => setPdfModalOpen(false)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      color: "#6d7175",
                      display: "flex",
                      alignItems: "center",
                      borderRadius: "4px",
                    }}
                    aria-label="Close"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M14 4L4 14M4 4l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              {/* PDF iframe fills the rest */}
              <iframe
                src={pdfDataUrl}
                style={{ flex: 1, border: "none", minHeight: "80vh" }}
                title={`PDF preview for ${po.po_number}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Line items ── */}
      <s-section heading="Line items">
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

        <div
          style={{
            border: "1px solid #e1e3e5",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isDraft
                ? "2fr 1fr 80px 100px 110px 40px"
                : "2fr 1fr 80px 100px 110px",
              padding: "10px 16px",
              background: "#f9fafb",
              borderBottom: "1px solid #e1e3e5",
            }}
          >
            {["Product", "SKU", "Qty", "Unit cost", "Line total"].map((h) => (
              <div key={h} style={{ fontSize: "12px", fontWeight: 600, color: "#6d7175", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {h}
              </div>
            ))}
            {isDraft && <div />}
          </div>

          {/* Table rows */}
          {po.purchase_order_line_items.map((line, idx) => (
            <div
              key={line.id}
              style={{
                display: "grid",
                gridTemplateColumns: isDraft
                  ? "2fr 1fr 80px 100px 110px 40px"
                  : "2fr 1fr 80px 100px 110px",
                padding: "12px 16px",
                alignItems: "center",
                borderBottom:
                  idx < po.purchase_order_line_items.length - 1
                    ? "1px solid #f3f4f6"
                    : "none",
                background: "#fff",
              }}
            >
              {/* Product cell with thumbnail */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "6px",
                    border: "1px solid #e1e3e5",
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "#f6f6f7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {line.image_url ? (
                    <img
                      src={line.image_url}
                      alt={line.product_name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="3" width="14" height="14" rx="2" stroke="#c9cccf" strokeWidth="1.5" />
                      <circle cx="7.5" cy="7.5" r="1.5" fill="#c9cccf" />
                      <path d="M3 13l4-4 3 3 2-2 5 5" stroke="#c9cccf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#202223" }}>
                    {line.product_name}
                  </div>
                  {line.variant_title && (
                    <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "1px" }}>
                      {line.variant_title}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: "14px", color: "#6d7175" }}>{line.sku ?? "—"}</div>

              <div style={{ fontSize: "14px", color: "#202223" }}>
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
              </div>

              <div style={{ fontSize: "14px", color: "#202223" }}>
                {line.unit_cost != null
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: po.currency }).format(line.unit_cost)
                  : "—"}
              </div>

              <div style={{ fontSize: "14px", fontWeight: 500, color: "#202223" }}>
                {line.line_total != null
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: po.currency }).format(line.line_total)
                  : "—"}
              </div>

              {isDraft && (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span
                    onClick={() => setDeleteTarget(line)}
                    onMouseOver={() => setHoveredDeleteId(line.id)}
                    onMouseOut={() => setHoveredDeleteId(null)}
                    style={{ cursor: "pointer", padding: "6px", lineHeight: 1, borderRadius: "4px" }}
                  >
                    <s-icon
                      type="delete"
                      {...(hoveredDeleteId === line.id ? { tone: "critical" } : { color: "subdued" })}
                    />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {isDraft && (
          <div style={{ marginTop: "12px" }}>
            <s-button
              onClick={() => {
                const fd = new FormData();
                fd.append("intent", "update-quantities");
                for (const line of po.purchase_order_line_items) {
                  fd.append("line_id", line.id);
                  const input = document.querySelector<HTMLInputElement>(`[name="qty-${line.id}"]`);
                  fd.append("quantity", input?.value ?? String(line.quantity_ordered));
                }
                submit(fd, { method: "post" });
              }}
            >
              Update quantities
            </s-button>
          </div>
        )}
      </s-section>

      {/* ── Email thread ── */}
      {thread && thread.messages.length > 0 && (
        <s-section heading="Email thread">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "420px",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {thread.messages.map((m) => {
              const isOwn =
                po.gmail_account_email != null &&
                m.from.toLowerCase().includes(po.gmail_account_email.toLowerCase());
              const senderInitial = m.from.charAt(0).toUpperCase();

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: isOwn ? "row-reverse" : "row",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: isOwn ? "#c9d8f0" : "#e2e8f0",
                      color: isOwn ? "#1d4ed8" : "#374151",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {senderInitial}
                  </div>

                  {/* Bubble */}
                  <div style={{ maxWidth: "80%" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6d7175",
                        marginBottom: "4px",
                        textAlign: isOwn ? "right" : "left",
                      }}
                    >
                      <strong style={{ color: "#202223" }}>{m.from}</strong>
                      {m.date ? ` on ${new Date(m.date).toLocaleString()}` : ""}
                    </div>
                    {m.subject && (
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#202223",
                          marginBottom: "4px",
                          textAlign: isOwn ? "right" : "left",
                        }}
                      >
                        {m.subject}
                      </div>
                    )}
                    <div
                      style={{
                        background: isOwn ? "#dbeafe" : "#f3f4f6",
                        borderRadius: isOwn ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
                        padding: "10px 14px",
                        fontSize: "14px",
                        color: "#202223",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {m.bodyText ?? m.snippet}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {gmail && (
            <div style={{ marginTop: "16px", borderTop: "1px solid #e1e3e5", paddingTop: "16px" }}>
              <s-text-area
                name="reply_body"
                label="Reply to supplier"
                rows={4}
                value={replyBody}
                onChange={(e: Event) => {
                  const t = e.target as HTMLTextAreaElement & { value: string };
                  setReplyBody(t.value);
                }}
              />
              <div style={{ marginTop: "8px" }}>
                <s-button variant="primary" onClick={handleSendReply} disabled={!replyBody.trim()}>
                  Send reply
                </s-button>
              </div>
            </div>
          )}
        </s-section>
      )}

      {/* ── Send this order (draft only) ── */}
      {isDraft && (
        <s-section heading="Send this order">
          {gmail ? (
            <s-stack direction="block" gap="base">
              <s-text-field
                label="Subject"
                value={emailSubject}
                onInput={(e: Event) => {
                  const t = e.target as HTMLInputElement & { value: string };
                  setEmailSubject(t.value);
                }}
              />
              <s-text-area
                label="Message"
                rows={12}
                value={emailBody}
                onInput={(e: Event) => {
                  const t = e.target as HTMLTextAreaElement & { value: string };
                  setEmailBody(t.value);
                }}
              />
              {pdfDataUrl && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: "#f6f6f7",
                    borderRadius: "6px",
                    fontSize: "13px",
                    color: "#333",
                  }}
                >
                  <s-icon type="attachment" />
                  <span>{po.po_number}.pdf</span>
                </div>
              )}
              <s-stack direction="inline" gap="base">
                <s-button
                  variant="primary"
                  onClick={() => handleSend("gmail")}
                  disabled={!emailSubject.trim() || !emailBody.trim()}
                >
                  Send via Gmail
                </s-button>
                <s-button onClick={() => handleSend("clipboard")}>Copy to clipboard</s-button>
              </s-stack>
            </s-stack>
          ) : (
            <s-stack direction="block" gap="base">
              <s-paragraph>Connect a Gmail account to send from your own address.</s-paragraph>
              <s-link href="/app/settings">
                <s-button variant="primary">Connect Gmail</s-button>
              </s-link>
              <s-button onClick={() => handleSend("clipboard")}>Copy to clipboard</s-button>
            </s-stack>
          )}
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
                onMouseOver={(e) => { e.currentTarget.style.background = "#f6f6f7"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; }}
              >
                {productLabel(p)}
              </div>
            ))
          ) : (
            <div style={{ padding: "12px", fontSize: "13px", color: "#6d7175", textAlign: "center" }}>
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
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)",
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
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "12px" }}>Remove product?</div>
            <div style={{ fontSize: "14px", color: "#6d7175", marginBottom: "20px" }}>
              Are you sure you want to remove{" "}
              <strong style={{ color: "#202223" }}>
                {deleteTarget.product_name}
                {deleteTarget.variant_title ? ` — ${deleteTarget.variant_title}` : ""}
              </strong>{" "}
              from this purchase order?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <s-button onClick={() => setDeleteTarget(null)}>Cancel</s-button>
              <s-button tone="critical" onClick={handleConfirmDelete}>Remove</s-button>
            </div>
          </div>
        </div>
      )}
    </TitleBar>
  );
}
