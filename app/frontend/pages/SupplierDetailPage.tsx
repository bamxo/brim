import { useEffect, useState } from "react";
import { useActionData, useFetcher, useLoaderData, useLocation, useSubmit } from "react-router";
import TitleBar from "../components/Header/TitleBar";
import SupplierForm from "../components/Supplier/SupplierForm";
import ProductCatalog, { type AssignedProduct, type CustomItem, type Product } from "../components/Supplier/ProductCatalog";
import DeleteModal from "../components/Supplier/DeleteSupplierModal";
import AddProductModal, { type CustomItemFormData, type ExistingSku } from "../components/Supplier/AddProductModal";

type LoaderData = {
  supplier: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    zip: string | null;
    country: string | null;
  };
  assignedProducts: AssignedProduct[];
  allProducts: Product[];
  customItems: CustomItem[];
  lastSyncedAt: string | null;
};

type ActionData = {
  errors?: Record<string, string | undefined>;
  success?: boolean;
  syncResult?: { synced: number; error: string | null };
  productOk?: boolean;
  productError?: string;
  customItemOk?: boolean;
  customItemError?: string;
};

type PendingStoreProduct = { id: string; title: string; sku: string | null };

export default function SupplierDetailPage() {
  const { supplier, assignedProducts, allProducts, customItems, lastSyncedAt } =
    useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const productFetcher = useFetcher<ActionData>();
  const customItemFetcher = useFetcher<ActionData>();

  const location = useLocation();
  const [editingItem, setEditingItem] = useState<CustomItem | null>(null);
  const [pendingStoreProduct, setPendingStoreProduct] = useState<PendingStoreProduct | null>(null);

  useEffect(() => {
    if (location.hash === "#product-catalog") {
      const el = document.getElementById("product-catalog");
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    }
  }, [location.hash]);

  const errors = (actionData?.errors ?? {}) as Record<string, string | undefined>;

  const existingSkus: ExistingSku[] = [
    ...assignedProducts
      .filter((p) => p.sku)
      .map((p) => ({ sku: p.sku!, productName: p.title })),
    ...customItems
      .filter((c) => c.sku)
      .map((c) => ({ sku: c.sku!, productName: c.name })),
  ];

  const openModal = () => {
    setTimeout(() => {
      const modal = document.getElementById("add-product-modal") as HTMLElement & {
        showOverlay: () => void;
      };
      modal?.showOverlay();
    }, 0);
  };

  const hideModal = () => {
    const modal = document.getElementById("add-product-modal") as HTMLElement & {
      hideOverlay: () => void;
    };
    modal?.hideOverlay();
  };

  // ── Delete supplier ─────────────────────────────────────────────
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

  // ── Store product: open dialog with pre-filled name ─────────────
  const handleAddProduct = (product: Product) => {
    setEditingItem(null);
    setPendingStoreProduct({ id: product.id, title: product.title, sku: product.sku });
    openModal();
  };

  const handleRemoveProduct = (productId: string) => {
    const fd = new FormData();
    fd.append("intent", "remove-product");
    fd.append("product_id", productId);
    productFetcher.submit(fd, { method: "post" });
  };

  // ── Custom item: open dialog empty ──────────────────────────────
  const showAddCustomModal = () => {
    setPendingStoreProduct(null);
    setEditingItem(null);
    openModal();
  };

  const showEditCustomModal = (item: CustomItem) => {
    setPendingStoreProduct(null);
    setEditingItem(item);
    openModal();
  };

  // ── Unified modal submit handler ────────────────────────────────
  const handleModalSubmit = (data: CustomItemFormData) => {
    const fd = new FormData();

    if (pendingStoreProduct) {
      fd.append("intent", "add-product");
      fd.append("product_id", pendingStoreProduct.id);
      if (data.sku) fd.append("sku", data.sku);
      if (data.unit_cost) fd.append("unit_cost", data.unit_cost);
      productFetcher.submit(fd, { method: "post" });
    } else if (editingItem) {
      fd.append("intent", "edit-custom-item");
      fd.append("item_id", editingItem.id);
      fd.append("name", data.name);
      fd.append("sku", data.sku);
      fd.append("unit_cost", data.unit_cost);
      customItemFetcher.submit(fd, { method: "post" });
    } else {
      fd.append("intent", "add-custom-item");
      fd.append("name", data.name);
      fd.append("sku", data.sku);
      fd.append("unit_cost", data.unit_cost);
      customItemFetcher.submit(fd, { method: "post" });
    }

    hideModal();
    setPendingStoreProduct(null);
    setEditingItem(null);
  };

  const handleRemoveCustomItem = (itemId: string) => {
    const fd = new FormData();
    fd.append("intent", "remove-custom-item");
    fd.append("item_id", itemId);
    customItemFetcher.submit(fd, { method: "post" });
  };

  return (
    <TitleBar
      heading={supplier.name}
      breadcrumbs={[{ label: "Suppliers", href: "/app/suppliers" }]}
    >
      <s-button slot="secondary-actions" tone="critical" onClick={handleDelete}>
        Delete supplier
      </s-button>

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

      <div id="product-catalog">
        <ProductCatalog
          allProducts={allProducts}
          assignedProducts={assignedProducts}
          customItems={customItems}
          lastSyncedAt={lastSyncedAt}
          productError={productFetcher.data?.productError}
          customItemError={customItemFetcher.data?.customItemError}
          onAddProduct={handleAddProduct}
          onRemoveProduct={handleRemoveProduct}
          onAddCustomItem={showAddCustomModal}
          onEditCustomItem={showEditCustomModal}
          onRemoveCustomItem={handleRemoveCustomItem}
        />
      </div>

      <DeleteModal
        modalId="delete-supplier-modal"
        supplierName={supplier.name}
        onConfirm={confirmDelete}
      />

      <AddProductModal
        modalId="add-product-modal"
        editingItem={editingItem}
        storeProduct={pendingStoreProduct}
        existingSkus={existingSkus}
        onSubmit={handleModalSubmit}
      />
    </TitleBar>
  );
}
