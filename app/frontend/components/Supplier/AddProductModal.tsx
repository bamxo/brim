import { useEffect } from "react";

export type CustomItemFormData = {
  name: string;
  sku: string;
  unit_cost: string;
};

type EditingItem = {
  id: string;
  name: string;
  sku: string | null;
  unit_cost: number | null;
};

type StoreProduct = {
  id: string;
  title: string;
  sku: string | null;
};

type Props = {
  modalId: string;
  editingItem?: EditingItem | null;
  storeProduct?: StoreProduct | null;
  onSubmit: (data: CustomItemFormData) => void;
};

export default function AddProductModal({ modalId, editingItem, storeProduct, onSubmit }: Props) {
  const isEditing = !!editingItem;
  const isStoreProduct = !!storeProduct;

  const prefill = editingItem
    ? { name: editingItem.name, sku: editingItem.sku ?? "", unit_cost: editingItem.unit_cost?.toString() ?? "" }
    : storeProduct
      ? { name: storeProduct.title, sku: storeProduct.sku ?? "", unit_cost: "" }
      : { name: "", sku: "", unit_cost: "" };

  useEffect(() => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const setField = (name: string, value: string) => {
      const el = modal.querySelector(`[name="${name}"]`) as HTMLElement & { value: string } | null;
      if (el) el.value = value;
    };
    setField("product_name", prefill.name);
    setField("sku", prefill.sku);
    setField("unit_cost", prefill.unit_cost);
  }, [editingItem, storeProduct, modalId, prefill.name, prefill.sku, prefill.unit_cost]);

  const handleSubmit = () => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const get = (name: string) =>
      (modal.querySelector(`[name="${name}"]`) as HTMLElement & { value: string })?.value ?? "";
    onSubmit({ name: get("product_name"), sku: get("sku"), unit_cost: get("unit_cost") });
  };

  const heading = isEditing
    ? "Edit catalog item"
    : isStoreProduct
      ? "Add store product"
      : "Add product to catalog";

  const submitLabel = isEditing ? "Save changes" : "Add to catalog";

  return (
    <s-modal id={modalId} heading={heading} size="base">
      <s-stack direction="block" gap="base">
        <s-text-field
          name="product_name"
          label="Product name"
          required
          value={prefill.name}
          disabled={isStoreProduct}
        />
        <s-text-field
          name="sku"
          label="SKU"
          value={prefill.sku}
        />
        <s-money-field
          name="unit_cost"
          label="Unit price"
          min={0}
          value={prefill.unit_cost}
        />
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        onClick={handleSubmit}
      >
        {submitLabel}
      </s-button>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        commandFor={modalId}
        command="--hide"
      >
        Cancel
      </s-button>
    </s-modal>
  );
}
