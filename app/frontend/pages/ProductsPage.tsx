import { useState } from "react";
import { useLoaderData } from "react-router";
import TitleBar from "../components/Header/TitleBar";
import SyncProductsButton from "../components/Supplier/SyncProductsButton";
import EmptyProductsState from "../components/Products/EmptyProductsState";
import ProductSearchBar from "../components/Products/ProductSearchBar";
import ProductsTable from "../components/Products/ProductsTable";

type ReorderRule = {
  id: string;
  reorder_point: number;
  reorder_quantity: number;
  is_active: boolean;
  primary_supplier: { name: string } | null;
};

type Product = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  current_stock: number;
  image_url: string | null;
  reorder_rules: ReorderRule[];
};

type LoaderData = { products: Product[]; lastSyncedAt: string | null };

export default function ProductsPage() {
  const { products, lastSyncedAt } = useLoaderData<LoaderData>();
  const [search, setSearch] = useState("");

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.variant_title ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <TitleBar heading="Products">
      {products.length === 0 ? (
        <EmptyProductsState lastSyncedAt={lastSyncedAt} />
      ) : (
        <s-section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "#202223" }}>
              Products
            </span>
            <SyncProductsButton lastSyncedAt={lastSyncedAt} />
          </div>

          <ProductSearchBar value={search} onChange={setSearch} />

          {filteredProducts.length === 0 ? (
            <div style={{ padding: "16px 14px", fontSize: 13, color: "#6d7175" }}>
              No products match your search.
            </div>
          ) : (
            <ProductsTable products={filteredProducts} />
          )}
        </s-section>
      )}
    </TitleBar>
  );
}
