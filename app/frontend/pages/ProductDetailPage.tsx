import { useState, useEffect } from "react";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "react-router";
import ClearRuleModal from "../components/Products/ClearRuleModal";
import { TooltipHeader } from "../components/Products/ToolTipHeader";

type Supplier = { id: string; name: string };

type LoaderData = {
  product: {
    id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    current_stock: number;
    image_url: string | null;
    last_synced_at: string | null;
  };
  rule: {
    reorder_point: number;
    reorder_quantity: number;
    unit_cost: number | null;
    primary_supplier_id: string | null;
    is_active: boolean;
  } | null;
  suppliers: Supplier[];
};

type ActionData = {
  success?: boolean;
  deleted?: boolean;
  errors: Record<string, string | undefined>;
};

export default function ProductDetailPage() {
  const { product, rule, suppliers } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const errors = actionData?.errors ?? {};

  const [savedOk, setSavedOk] = useState(false);
  useEffect(() => {
    if (actionData?.success && !actionData.deleted) {
      setSavedOk(true);
      const t = setTimeout(() => setSavedOk(false), 4000);
      return () => clearTimeout(t);
    }
  }, [actionData]); // eslint-disable-line react-hooks/exhaustive-deps

  const supplierOptions = [
    { label: "— None —", value: "" },
    ...suppliers.map((s) => ({ label: s.name, value: s.id })),
  ];

  const stockTone =
    rule && product.current_stock <= rule.reorder_point ? "warning" : "success";

  // Manual FormData harvest — Polaris fields don't participate in native FormData
  const handleSave = () => {
    const form = document.getElementById("rule-form") as HTMLFormElement;
    if (!form) return;
    const get = (name: string) =>
      (form.querySelector(`[name="${name}"]`) as HTMLElement & { value: string })?.value ?? "";
    const fd = new FormData();
    fd.append("reorder_point", get("reorder_point"));
    fd.append("reorder_quantity", get("reorder_quantity"));
    fd.append("unit_cost", get("unit_cost"));
    fd.append("primary_supplier_id", get("primary_supplier_id"));
    submit(fd, { method: "post" });
  };

  return (
    <s-page heading={product.title}>
      {"form" in errors && (
        <s-banner tone="critical" heading="Could not save rule">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Product info" slot="aside">
        <s-thumbnail
          src={product.image_url ?? undefined}
          alt={product.title}
          size="large"
        />
        <s-paragraph>
          <s-text>Variant: </s-text>
          <s-text>{product.variant_title ?? "Default"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>SKU: </s-text>
          <s-text>{product.sku ?? "—"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Current stock: </s-text>
          <s-badge tone={stockTone}>{String(product.current_stock)}</s-badge>
        </s-paragraph>
        {product.last_synced_at && (
          <s-paragraph>
            <s-text>Last synced: </s-text>
            <s-text>{new Date(product.last_synced_at).toLocaleString()}</s-text>
          </s-paragraph>
        )}
      </s-section>

      <s-section heading="Reorder rule">
        <form id="rule-form" method="post">
          <s-stack direction="block" gap="base">
            {/* Reorder point — label, asterisk, then tooltip icon (smaller, darker) */}
            <div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#202223" }}>
                  <TooltipHeader
                    label="Reorder point"
                    tooltip="When your stock drops to or below this number, Brim automatically creates a draft purchase order for this product."
                    required
                  />
                </span>
              </div>
              <s-number-field
                name="reorder_point"
                min={0}
                required
                value={rule ? String(rule.reorder_point) : ""}
                error={"reorder_point" in errors ? errors.reorder_point : undefined}
              />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#202223" }}>
                  <TooltipHeader
                    label="Reorder quantity"
                    tooltip="The number of units to include in the purchase order each time a reorder is triggered."
                    required
                  />
                </span>
              </div>
              <s-number-field
                name="reorder_quantity"
                min={1}
                required
                value={rule ? String(rule.reorder_quantity) : ""}
                error={"reorder_quantity" in errors ? errors.reorder_quantity : undefined}
              />
            </div>

            <s-number-field
              name="unit_cost"
              label="Unit cost"
              min={0}
              step={0.01}
              value={rule?.unit_cost != null ? String(rule.unit_cost) : ""}
              help-text="Used to calculate purchase order total amounts"
            />
            <s-select
              name="primary_supplier_id"
              label="Primary supplier"
              required
              value={rule?.primary_supplier_id ?? ""}
              error={"primary_supplier_id" in errors ? errors.primary_supplier_id : undefined}
            >
              {supplierOptions.map((opt) => (
                <s-option key={opt.value} value={opt.value}>{opt.label}</s-option>
              ))}
            </s-select>
          </s-stack>
        </form>

        {/* Bottom row — inline success feedback left, buttons right */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: savedOk ? "#007a5a" : "transparent",
              fontWeight: 500,
              transition: "color 0.2s",
            }}
          >
            ✓ Rule saved
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <s-button onClick={() => navigate("/app/products")}>Cancel</s-button>
            <s-button variant="primary" onClick={handleSave}>Save rule</s-button>
          </div>
        </div>
      </s-section>

      {rule?.is_active && (
        <s-section heading="Danger zone" slot="aside">
          <s-paragraph>
            Clears all reorder rule information for this product — including
            supplier, reorder point, quantity, and unit cost. Brim will stop
            creating purchase orders automatically. This action cannot be undone.
          </s-paragraph>
          <s-button
            tone="critical"
            onClick={() => {
              const modal = document.getElementById("clear-rule-modal") as HTMLElement & {
                showOverlay: () => void;
              };
              modal?.showOverlay();
            }}
          >
            Clear reorder rule
          </s-button>
        </s-section>
      )}

      <ClearRuleModal
        modalId="clear-rule-modal"
        productName={product.title}
        onConfirm={() => {
          const fd = new FormData();
          fd.append("intent", "clear-rule");
          submit(fd, { method: "post" });
        }}
      />
    </s-page>
  );
}
