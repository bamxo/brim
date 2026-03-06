import { useActionData, useFetcher, useLoaderData, useSubmit } from "react-router";
import SupplierForm from "../components/Supplier/SupplierForm";
import ProductCatalog, { type AssignedProduct, type Product } from "../components/Supplier/ProductCatalog";
import DeleteModal from "../components/Supplier/DeleteSupplierModal";

type LoaderData = {
  supplier: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
  };
  assignedProducts: AssignedProduct[];
  allProducts: Product[];
  lastSyncedAt: string | null;
};

type ActionData = {
  errors?: Record<string, string | undefined>;
  success?: boolean;
  syncResult?: { synced: number; error: string | null };
  productOk?: boolean;
  productError?: string;
};

export default function SupplierDetailPage() {
  const { supplier, assignedProducts, allProducts, lastSyncedAt } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const productFetcher = useFetcher<ActionData>();

  const errors = (actionData?.errors ?? {}) as Record<string, string | undefined>;

  const handleDelete = () => {
    const modal = document.getElementById("delete-supplier-modal") as HTMLElement & {
      showOverlay: () => void;
    };
    modal?.showOverlay();
  };

  const confirmDelete = () => {
    const fd = new FormData();
    fd.append("intent", "delete");
    submit(fd, { method: "post" });
  };

  const handleAddProduct = (productId: string) => {
    const fd = new FormData();
    fd.append("intent", "add-product");
    fd.append("product_id", productId);
    productFetcher.submit(fd, { method: "post" });
  };

  const handleRemoveProduct = (productId: string) => {
    const fd = new FormData();
    fd.append("intent", "remove-product");
    fd.append("product_id", productId);
    productFetcher.submit(fd, { method: "post" });
  };

  return (
    <s-page heading={supplier.name}>
      {"form" in errors && (
        <s-banner tone="critical" heading="Could not save supplier">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <SupplierForm
        supplier={supplier}
        errors={errors}
        actionData={actionData}
      />

      <ProductCatalog
        allProducts={allProducts}
        assignedProducts={assignedProducts}
        lastSyncedAt={lastSyncedAt}
        productError={productFetcher.data?.productError}
        onAddProduct={handleAddProduct}
        onRemoveProduct={handleRemoveProduct}
      />

      <DeleteModal
        modalId="delete-supplier-modal"
        supplierName={supplier.name}
        onConfirm={confirmDelete}
      />

      <s-section heading="Danger zone" slot="aside">
        <s-paragraph>
          Permanently deletes this supplier and removes them from all active
          reorder rules. Historical purchase orders are kept but will no longer
          reference this supplier. This action cannot be undone.
        </s-paragraph>
        <s-button tone="critical" onClick={handleDelete}>
          Delete supplier
        </s-button>
      </s-section>
    </s-page>
  );
}
