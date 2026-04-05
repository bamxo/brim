type Supplier = { id: string; name: string };

type Rule = {
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number | null;
  primary_supplier_id: string | null;
  is_active: boolean;
};

type Props = {
  rule: Rule | null;
  suppliers: Supplier[];
  errors: Record<string, string | undefined>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  savedOk: boolean;
};

export default function ReorderRuleForm({
  rule,
  suppliers,
  errors,
  onSave,
  onCancel,
  saving,
  savedOk,
}: Props) {
  const supplierOptions = [
    { label: "— None —", value: "" },
    ...suppliers.map((s) => ({ label: s.name, value: s.id })),
  ];

  return (
    <s-section heading="Reorder rule">
      <form id="rule-form" method="post">
        <s-stack direction="block" gap="base">
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, color: "#202223", whiteSpace: "nowrap" }}>
              <span>Reorder point</span>
              <span style={{ color: "#d82c0d" }}>*</span>
              <s-clickable interestFor="tooltip-reorder-point">
                <s-icon type="question-circle" />
              </s-clickable>
              <s-tooltip id="tooltip-reorder-point">When your stock drops to or below this number, Brim automatically creates a draft purchase order for this product.</s-tooltip>
            </span>
            <s-number-field
              name="reorder_point"
              min={0}
              required
              value={rule ? String(rule.reorder_point) : ""}
              error={"reorder_point" in errors ? errors.reorder_point : undefined}
            />
          </div>

          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, color: "#202223", whiteSpace: "nowrap" }}>
              <span>Reorder quantity</span>
              <span style={{ color: "#d82c0d" }}>*</span>
              <s-clickable interestFor="tooltip-reorder-quantity">
                <s-icon type="question-circle" />
              </s-clickable>
              <s-tooltip id="tooltip-reorder-quantity">The number of units to include in the purchase order each time a reorder is triggered.</s-tooltip>
            </span>
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
          <s-button onClick={onCancel}>Cancel</s-button>
          <s-button variant="primary" loading={saving} onClick={onSave}>Save rule</s-button>
        </div>
      </div>
    </s-section>
  );
}
