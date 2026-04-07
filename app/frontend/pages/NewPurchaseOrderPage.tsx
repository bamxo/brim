import { useState, useEffect, useCallback } from "react";
import { useActionData, useLoaderData, useSubmit } from "react-router";
import TitleBar from "../components/Header/TitleBar";

type Supplier = { id: string; name: string };
type Product = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  image_url: string | null;
  current_stock: number;
  shopify_variant_id: string;
};
type Location = { id: string; name: string };

type LineItem = {
  product_id: string;
  shopify_variant_id: string;
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  unit_cost: number | null;
};

type LoaderData = {
  suppliers: Supplier[];
  products: Product[];
  locations: Location[];
  currency: string;
};

function productLabel(p: Product): string {
  let label = p.title;
  if (p.variant_title) label += ` — ${p.variant_title}`;
  if (p.sku) label += ` (${p.sku})`;
  return label;
}

export default function NewPurchaseOrderPage() {
  const { suppliers, products, locations, currency } = useLoaderData<LoaderData>();
  const actionData = useActionData<{ errors?: Record<string, string | undefined> }>();
  const submit = useSubmit();
  const errors = (actionData?.errors ?? {}) as Record<string, string | undefined>;

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [selectedLocationName, setSelectedLocationName] = useState("");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationDropdownPos, setLocationDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updateDropdownPos = useCallback(() => {
    const el = document.getElementById("product-search-container");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
  }, []);

  const updateLocationDropdownPos = useCallback(() => {
    const el = document.getElementById("location-search-container");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setLocationDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    const el = document.querySelector('[name="supplier_id"]') as
      | (HTMLElement & { value: string })
      | null;
    if (!el) return;
    const handler = () => setSelectedSupplierId((el as HTMLElement & { value: string }).value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const el = document.getElementById("product-search") as
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
  }, [selectedSupplierId, updateDropdownPos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const container = document.getElementById("product-search-container");
      const dropdown = document.getElementById("product-dropdown");
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

  useEffect(() => {
    const el = document.getElementById("location-search") as
      | (HTMLElement & { value: string })
      | null;
    if (!el) return;

    const onInput = () => {
      const val = (el as HTMLElement & { value: string }).value;
      setLocationSearch(val);
      setSelectedLocationName("");
      updateLocationDropdownPos();
      setShowLocationDropdown(true);
    };
    const onFocus = () => {
      updateLocationDropdownPos();
      setShowLocationDropdown(true);
    };

    el.addEventListener("input", onInput);
    el.addEventListener("focus", onFocus);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("focus", onFocus);
    };
  }, [updateLocationDropdownPos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const container = document.getElementById("location-search-container");
      const dropdown = document.getElementById("location-dropdown");
      const target = e.target as Node;
      if (
        container && !container.contains(target) &&
        (!dropdown || !dropdown.contains(target))
      ) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectLocation = useCallback((loc: Location) => {
    setSelectedLocationName(loc.name);
    setLocationSearch(loc.name);
    setShowLocationDropdown(false);
    const el = document.getElementById("location-search") as
      | (HTMLElement & { value: string })
      | null;
    if (el) el.value = loc.name;
  }, []);

  const handleSelectProduct = useCallback(
    (product: Product) => {
      if (lineItems.some((li) => li.product_id === product.id)) return;
      setLineItems((prev) => [
        ...prev,
        {
          product_id: product.id,
          shopify_variant_id: product.shopify_variant_id,
          product_name: product.title,
          variant_title: product.variant_title,
          sku: product.sku,
          quantity: 1,
          unit_cost: null,
        },
      ]);
      setProductSearch("");
      setShowProductDropdown(false);
      const el = document.getElementById("product-search") as
        | (HTMLElement & { value: string })
        | null;
      if (el) el.value = "";
    },
    [lineItems],
  );

  const handleRemoveProduct = useCallback((productId: string) => {
    setLineItems((prev) => prev.filter((li) => li.product_id !== productId));
  }, []);

  const handleQuantityChange = useCallback((productId: string, value: string) => {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 1) return;
    setLineItems((prev) =>
      prev.map((li) => (li.product_id === productId ? { ...li, quantity: qty } : li)),
    );
  }, []);

  const handleUnitCostChange = useCallback((productId: string, value: string) => {
    const cost = value ? parseFloat(value) : null;
    setLineItems((prev) =>
      prev.map((li) => (li.product_id === productId ? { ...li, unit_cost: cost } : li)),
    );
  }, []);

  useEffect(() => {
    const handleChange = (e: Event) => {
      const target = e.target as HTMLElement & { name: string; value: string };
      const name = target.getAttribute("name") ?? target.name;
      if (!name) return;

      if (name.startsWith("qty-")) {
        handleQuantityChange(name.replace("qty-", ""), target.value);
      } else if (name.startsWith("cost-")) {
        handleUnitCostChange(name.replace("cost-", ""), target.value);
      }
    };

    const container = document.getElementById("line-items-table");
    if (!container) return;
    container.addEventListener("change", handleChange);
    return () => container.removeEventListener("change", handleChange);
  }, [handleQuantityChange, handleUnitCostChange]);

  const handleSubmit = (intent: string) => {
    const form = document.getElementById("po-form") as HTMLFormElement;
    if (!form) return;

    const get = (name: string) =>
      (form.querySelector(`[name="${name}"]`) as HTMLElement & { value: string })?.value ?? "";

    const fd = new FormData();
    fd.append("intent", intent);
    fd.append("supplier_id", get("supplier_id"));
    fd.append("delivery_location", selectedLocationName);
    fd.append("requested_delivery_date", get("requested_delivery_date"));
    fd.append("payment_terms", get("payment_terms"));
    fd.append("notes", get("notes"));
    fd.append("line_items", JSON.stringify(lineItems));

    submit(fd, { method: "post" });
  };

  const availableProducts = products.filter(
    (p) => !lineItems.some((li) => li.product_id === p.id),
  );

  const filteredProducts = availableProducts.filter((p) => {
    if (!productSearch) return true;
    return productLabel(p).toLowerCase().includes(productSearch.toLowerCase());
  });

  const filteredLocations = locations.filter((loc) => {
    if (!locationSearch || locationSearch === selectedLocationName) return true;
    return loc.name.toLowerCase().includes(locationSearch.toLowerCase());
  });

  const totalItems = lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const totalAmount = lineItems.reduce((sum, li) => {
    if (li.unit_cost != null) return sum + li.unit_cost * li.quantity;
    return sum;
  }, 0);

  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });

  return (
    <TitleBar
      heading="Create Purchase Order"
      breadcrumbs={[{ label: "Purchase Orders", href: "/app/purchase-orders" }]}
    >
      {"form" in errors && (
        <s-banner tone="critical" heading="Could not create purchase order">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <form id="po-form" method="post">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: "16px",
            alignItems: "start",
          }}
        >
          {/* ─── Left column ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <s-section heading="Supplier and Products">
              <s-select
                name="supplier_id"
                label="Select Supplier"
                required
                error={"supplier_id" in errors ? errors.supplier_id : undefined}
              >
                <s-option value="">Select a supplier</s-option>
                {suppliers.map((s) => (
                  <s-option key={s.id} value={s.id}>
                    {s.name}
                  </s-option>
                ))}
              </s-select>

              {"line_items" in errors && (
                <s-banner tone="critical" style={{ marginTop: "12px" }}>
                  <s-paragraph>{errors.line_items}</s-paragraph>
                </s-banner>
              )}

              {selectedSupplierId ? (
                <div style={{ marginTop: "16px" }}>
                  <div id="product-search-container" style={{ position: "relative" }}>
                    <s-text-field
                      id="product-search"
                      label="Search and add products"
                      placeholder="Search by name, SKU, or variant"
                      value={productSearch}
                      autocomplete="off"
                    />
                    {/* Dropdown rendered with position:fixed to escape s-section overflow */}
                  </div>

                  {lineItems.length > 0 && (
                    <div id="line-items-table" style={{ marginTop: "20px" }}>
                      <div style={{ marginBottom: "8px" }}>
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>Items</span>
                      </div>
                      <s-table>
                        <s-table-header-row>
                          <s-table-header>Product</s-table-header>
                          <s-table-header>SKU</s-table-header>
                          <s-table-header>Quantity</s-table-header>
                          <s-table-header>Unit Cost</s-table-header>
                          <s-table-header></s-table-header>
                        </s-table-header-row>
                        <s-table-body>
                          {lineItems.map((li) => (
                            <s-table-row key={li.product_id}>
                              <s-table-cell>
                                {li.product_name}
                                {li.variant_title ? ` — ${li.variant_title}` : ""}
                              </s-table-cell>
                              <s-table-cell>{li.sku ?? "—"}</s-table-cell>
                              <s-table-cell>
                                <div style={{ maxWidth: "100px" }}>
                                  <s-number-field
                                    name={`qty-${li.product_id}`}
                                    label="Quantity"
                                    label-hidden
                                    min={1}
                                    value={String(li.quantity)}
                                  />
                                </div>
                              </s-table-cell>
                              <s-table-cell>
                                <div style={{ maxWidth: "120px" }}>
                                  <s-number-field
                                    name={`cost-${li.product_id}`}
                                    label="Unit cost"
                                    label-hidden
                                    min={0}
                                    step={0.01}
                                    value={li.unit_cost != null ? String(li.unit_cost) : ""}
                                  />
                                </div>
                              </s-table-cell>
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
                                    onClick={() => handleRemoveProduct(li.product_id)}
                                    onMouseOver={() => setHoveredDeleteId(li.product_id)}
                                    onMouseOut={() => setHoveredDeleteId(null)}
                                    style={{
                                      cursor: "pointer",
                                      padding: "6px",
                                      lineHeight: 1,
                                    }}
                                  >
                                    <s-icon
                                      type="delete"
                                      {...(hoveredDeleteId === li.product_id
                                        ? { tone: "critical" }
                                        : { color: "subdued" })}
                                    />
                                  </span>
                                </div>
                              </s-table-cell>
                            </s-table-row>
                          ))}
                        </s-table-body>
                      </s-table>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "20px 16px",
                    background: "#f6f6f7",
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <s-paragraph>Select a supplier above to add products</s-paragraph>
                </div>
              )}
            </s-section>

            <s-section heading="Payment & Delivery">
              <s-stack direction="block" gap="base">
                <div id="location-search-container" style={{ position: "relative" }}>
                  <s-text-field
                    id="location-search"
                    label="Delivery Location"
                    placeholder="Select a location"
                    value={locationSearch}
                    required
                    autocomplete="off"
                    error={"delivery_location" in errors ? errors.delivery_location : undefined}
                  />
                </div>

                <s-date-field
                  name="requested_delivery_date"
                  label="Expected Delivery Date"
                  placeholder="Select date"
                />

                <s-select name="payment_terms" label="Payment Terms">
                  <s-option value="">Select payment terms</s-option>
                  <s-option value="due_on_receipt">Due on receipt</s-option>
                  <s-option value="net_15">Net 15</s-option>
                  <s-option value="net_30">Net 30</s-option>
                  <s-option value="net_60">Net 60</s-option>
                  <s-option value="net_90">Net 90</s-option>
                </s-select>
              </s-stack>
            </s-section>
          </div>

          {/* ─── Right column ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <s-section heading="Summary">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Total Items</span>
                  <span>{totalItems}</span>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid #e1e3e5", margin: 0 }} />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Estimated Cost</span>
                  <span style={{ fontWeight: 600 }}>{fmt.format(totalAmount)}</span>
                </div>

                <div
                  style={{
                    paddingLeft: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "#6d7175" }}>Breakdown:</span>
                    <span style={{ fontSize: "13px" }}>{fmt.format(totalAmount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "#6d7175" }}>Estimated Cost:</span>
                    <span style={{ fontSize: "13px" }}>{fmt.format(0)}</span>
                  </div>
                  <hr style={{ border: "none", borderTop: "1px solid #e1e3e5", margin: 0 }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}>Total</span>
                    <span style={{ fontWeight: 600 }}>{fmt.format(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </s-section>

            <s-section heading="Additional Details">
              <s-text-area
                name="notes"
                label="Notes"
                placeholder="Add notes for this purchase order..."
              />
            </s-section>
          </div>
        </div>
      </form>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          marginTop: "16px",
          padding: "0 20px 20px",
        }}
      >
        <s-button onClick={() => handleSubmit("save-draft")}>Save as draft</s-button>
        <s-button variant="primary" onClick={() => handleSubmit("review-send")}>
          Review &amp; send
        </s-button>
      </div>

      {showProductDropdown && (
        <div
          id="product-dropdown"
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
                onMouseDown={() => handleSelectProduct(p)}
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
              No products found
            </div>
          )}
        </div>
      )}

      {showLocationDropdown && (
        <div
          id="location-dropdown"
          style={{
            position: "fixed",
            top: locationDropdownPos.top,
            left: locationDropdownPos.left,
            width: locationDropdownPos.width,
            background: "#fff",
            border: "1px solid #e1e3e5",
            borderRadius: "0 0 8px 8px",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          <a
            href="shopify://admin/settings/locations"
            target="_top"
            onMouseDown={(e) => e.preventDefault()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 12px",
              fontSize: "14px",
              color: "#2c6ecb",
              textDecoration: "none",
              borderBottom: "1px solid #e1e3e5",
              fontWeight: 500,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#f6f6f7";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#fff";
            }}
          >
            <s-icon type="plus" size="small" />
            Add a location
          </a>
          {filteredLocations.length > 0 ? (
            filteredLocations.map((loc) => (
              <div
                key={loc.id}
                onMouseDown={() => handleSelectLocation(loc)}
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
                {loc.name}
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
              No locations found
            </div>
          )}
        </div>
      )}
    </TitleBar>
  );
}
