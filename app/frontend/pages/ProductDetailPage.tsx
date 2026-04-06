import { useState, useEffect } from "react";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "react-router";
import TitleBar from "../components/Header/TitleBar";
import ClearRuleModal from "../components/Products/ClearRuleModal";
import ProductInfoSidebar from "../components/Products/ProductInfoSidebar";
import ReorderRuleForm from "../components/Products/ReorderRuleForm";
import DangerZoneSection from "../components/Products/DangerZoneSection";

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
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSaving(false);
    if (actionData?.success && !actionData.deleted) {
      setSavedOk(true);
      const t = setTimeout(() => setSavedOk(false), 4000);
      return () => clearTimeout(t);
    }
  }, [actionData]); // eslint-disable-line react-hooks/exhaustive-deps

  const stockTone =
    rule && product.current_stock <= rule.reorder_point ? "warning" as const : "success" as const;

  const handleSave = () => {
    setSaving(true);
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

  const handleClearRule = () => {
    const modal = document.getElementById("clear-rule-modal") as HTMLElement & {
      showOverlay: () => void;
    };
    modal?.showOverlay();
  };

  return (
    <TitleBar heading={product.title} breadcrumbs={[{ label: "Products", href: "/app/products" }]}>
      {"form" in errors && (
        <s-banner tone="critical" heading="Could not save rule">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <ProductInfoSidebar product={product} stockTone={stockTone} />

      <ReorderRuleForm
        rule={rule}
        suppliers={suppliers}
        errors={errors}
        onSave={handleSave}
        onCancel={() => navigate("/app/products")}
        saving={saving}
        savedOk={savedOk}
      />

      {rule?.is_active && (
        <DangerZoneSection onClearRule={handleClearRule} />
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
    </TitleBar>
  );
}
