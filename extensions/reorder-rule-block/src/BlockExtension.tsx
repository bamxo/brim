/** @jsxImportSource preact */
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

interface Rule {
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number | null;
  primary_supplier_id: string | null;
  is_active: boolean;
}

function extractShopifyId(gid: string) {
  // gid://shopify/Product/123456 → "123456"
  return gid.split("/").pop() ?? "";
}

function BlockExtension() {
  const productGid = shopify.data.selected[0]?.id ?? "";
  const productId = extractShopifyId(productGid);

  const [loading, setLoading] = useState(!!productId);
  const [notSynced, setNotSynced] = useState(false);
  const [rule, setRule] = useState<Rule | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [reorderPoint, setReorderPoint] = useState("");
  const [reorderQuantity, setReorderQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [primarySupplierId, setPrimarySupplierId] = useState("");

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setFetchError(null);

    Promise.all([
      fetch(`/api/ext/products/${productId}/reorder-rule`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(`/api/ext/products/${productId}/suppliers`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ])
      .then(([ruleData, supplierData]: [{ notSynced?: boolean; rule?: Rule }, { suppliers?: { id: string; name: string }[] }]) => {
        if (ruleData.notSynced) {
          setNotSynced(true);
          return;
        }
        if (ruleData.rule) {
          const r = ruleData.rule;
          setRule(r);
          setReorderPoint(String(r.reorder_point));
          setReorderQuantity(String(r.reorder_quantity));
          setUnitCost(r.unit_cost != null ? String(r.unit_cost) : "");
          setPrimarySupplierId(r.primary_supplier_id ?? "");
        }
        setSuppliers(supplierData.suppliers ?? []);
      })
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    if (!savedOk) return;
    const t = setTimeout(() => setSavedOk(false), 4000);
    return () => clearTimeout(t);
  }, [savedOk]);

  const handleSave = async () => {
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const res = await fetch(`/api/ext/products/${productId}/reorder-rule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reorder_point: Number(reorderPoint),
          reorder_quantity: Number(reorderQuantity),
          unit_cost: unitCost !== "" ? Number(unitCost) : null,
          primary_supplier_id: primarySupplierId || null,
        }),
      });
      const data: { success: boolean; errors?: Record<string, string> } = await res.json();
      if (data.success) {
        setRule({
          reorder_point: Number(reorderPoint),
          reorder_quantity: Number(reorderQuantity),
          unit_cost: unitCost !== "" ? Number(unitCost) : null,
          primary_supplier_id: primarySupplierId || null,
          is_active: true,
        });
        setSavedOk(true);
      } else {
        setFieldErrors(data.errors ?? {});
        if (data.errors?.form) setFormError(data.errors.form);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/ext/products/${productId}/reorder-rule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "clear-rule" }),
      });
      const data: { success: boolean; errors?: Record<string, string> } = await res.json();
      if (data.success) {
        setRule(null);
        setReorderPoint("");
        setReorderQuantity("");
        setUnitCost("");
        setPrimarySupplierId("");
        setShowClearConfirm(false);
        setSavedOk(true);
      } else {
        setFormError(data.errors?.form ?? "Clear failed");
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setSaving(false);
    }
  };

  if (!productId) {
    return (
      <s-admin-block heading="Brim Reorder Rule">
        <s-text>No product selected.</s-text>
      </s-admin-block>
    );
  }

  if (loading) {
    return (
      <s-admin-block heading="Brim Reorder Rule">
        <s-spinner />
      </s-admin-block>
    );
  }

  if (fetchError) {
    return (
      <s-admin-block heading="Brim Reorder Rule">
        <s-banner tone="critical">{fetchError}</s-banner>
      </s-admin-block>
    );
  }

  if (notSynced) {
    return (
      <s-admin-block heading="Brim Reorder Rule">
        <s-stack direction="block" gap="base">
          <s-text>This product hasn't been synced to Brim yet.</s-text>
          <s-link href="app:products/sync">Sync products</s-link>
        </s-stack>
      </s-admin-block>
    );
  }

  return (
    <s-admin-block heading="Brim Reorder Rule">
      <s-stack direction="block" gap="base">
        {savedOk && <s-banner tone="success">Rule saved</s-banner>}
        {formError && <s-banner tone="critical">{formError}</s-banner>}

        <s-stack direction="inline" gap="none">
          <s-box inlineSize="50%" paddingInlineEnd="base">
            <s-number-field
              label="Reorder point"
              name="reorder_point"
              min={0}
              required
              value={reorderPoint}
              onChange={(e: Event) => setReorderPoint((e.target as HTMLInputElement).value)}
              error={fieldErrors.reorder_point}
            />
          </s-box>
          <s-box inlineSize="50%">
            <s-number-field
              label="Reorder quantity"
              name="reorder_quantity"
              min={1}
              required
              value={reorderQuantity}
              onChange={(e: Event) => setReorderQuantity((e.target as HTMLInputElement).value)}
              error={fieldErrors.reorder_quantity}
            />
          </s-box>
        </s-stack>
        <s-stack direction="inline" gap="none">
          <s-box inlineSize="50%" paddingInlineEnd="base">
            <s-number-field
              label="Unit cost"
              name="unit_cost"
              min={0}
              step={0.01}
              value={unitCost}
              onChange={(e: Event) => setUnitCost((e.target as HTMLInputElement).value)}
              details="Used to calculate purchase order total amounts"
            />
          </s-box>
          <s-box inlineSize="50%">
            <s-select
              label="Primary supplier"
              name="primary_supplier_id"
              required
              value={primarySupplierId}
              onChange={(e: Event) => setPrimarySupplierId((e.target as HTMLSelectElement).value)}
              error={fieldErrors.primary_supplier_id}
            >
              <s-option value="">— None —</s-option>
              {suppliers.map((s) => (
                <s-option key={s.id} value={s.id}>{s.name}</s-option>
              ))}
            </s-select>
          </s-box>
        </s-stack>

        {rule?.is_active && !showClearConfirm && (
          <s-stack direction="block" gap="base">
            <s-divider />
            <s-text>
              Clears all reorder rule info. Brim will stop creating purchase orders automatically.
            </s-text>
            <s-button tone="critical" disabled={saving} onClick={() => setShowClearConfirm(true)}>
              Clear reorder rule
            </s-button>
          </s-stack>
        )}

        {rule?.is_active && showClearConfirm && (
          <s-stack direction="block" gap="base">
            <s-divider />
            <s-banner tone="critical">Are you sure? This action cannot be undone.</s-banner>
            <s-stack direction="inline" gap="base">
              <s-button disabled={saving} onClick={() => setShowClearConfirm(false)}>Cancel</s-button>
              <s-button tone="critical" loading={saving} onClick={handleClear}>
                Confirm clear
              </s-button>
            </s-stack>
          </s-stack>
        )}

        <s-divider />
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-link href="app:products">Manage purchase orders & more in Brim →</s-link>
          <s-button variant="primary" loading={saving} onClick={handleSave}>
            Save rule
          </s-button>
        </s-stack>
      </s-stack>
    </s-admin-block>
  );
}

export default async () => {
  render(<BlockExtension />, document.body);
};
