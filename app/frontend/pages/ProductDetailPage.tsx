import { useActionData, useLoaderData, useNavigate } from "react-router";

type Supplier = { id: string; name: string };

type LoaderData = {
  product: {
    id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    current_stock: number;
    last_synced_at: string | null;
  };
  rule: {
    reorder_point: number;
    reorder_quantity: number;
    unit_cost: number | null;
    primary_supplier_id: string | null;
    backup_supplier_id: string | null;
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
  const errors = actionData?.errors ?? {};

  const supplierOptions = [
    { label: "— None —", value: "" },
    ...suppliers.map((s) => ({ label: s.name, value: s.id })),
  ];

  const stockTone =
    rule && product.current_stock <= rule.reorder_point ? "warning" : "success";

  return (
    <s-page heading={product.title}>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => {
          const form = document.getElementById("rule-form") as HTMLFormElement;
          if (form) form.requestSubmit();
        }}
      >
        Save rule
      </s-button>
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/products")}
      >
        Back to products
      </s-button>

      {actionData?.success && !actionData?.deleted && (
        <s-banner tone="success" heading="Reorder rule saved" />
      )}
      {"form" in errors && (
        <s-banner tone="critical" heading="Could not save rule">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Product info" slot="aside">
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
            <s-number-field
              name="reorder_point"
              label="Reorder point"
              min={0}
              required
              value={rule ? String(rule.reorder_point) : ""}
              help-text="When stock drops to this level, a draft purchase order is created"
              error={"reorder_point" in errors ? errors.reorder_point : undefined}
            />
            <s-number-field
              name="reorder_quantity"
              label="Reorder quantity"
              min={1}
              required
              value={rule ? String(rule.reorder_quantity) : ""}
              help-text="How many units to order each time"
              error={"reorder_quantity" in errors ? errors.reorder_quantity : undefined}
            />
            <s-number-field
              name="unit_cost"
              label="Unit cost"
              min={0}
              step={0.01}
              value={rule?.unit_cost != null ? String(rule.unit_cost) : ""}
              help-text="Used to calculate PO total amounts"
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
            <s-select
              name="backup_supplier_id"
              label="Backup supplier"
              value={rule?.backup_supplier_id ?? ""}
              help-text="Used if the primary supplier is unavailable"
            >
              {supplierOptions.map((opt) => (
                <s-option key={opt.value} value={opt.value}>{opt.label}</s-option>
              ))}
            </s-select>
          </s-stack>
        </form>
      </s-section>

      {rule?.is_active && (
        <s-section heading="Danger zone" slot="aside">
          <s-paragraph>
            Disabling this rule will stop Brim from automatically creating
            purchase orders for this product.
          </s-paragraph>
          <form method="post">
            <input type="hidden" name="intent" value="delete-rule" />
            <s-button tone="critical" type="submit">
              Disable reorder rule
            </s-button>
          </form>
        </s-section>
      )}
    </s-page>
  );
}
