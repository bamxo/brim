import { useNavigate } from "react-router";

export type Supplier = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
};

type Props = { suppliers: Supplier[] };

export default function SupplierTable({ suppliers }: Props) {
  const navigate = useNavigate();

  if (suppliers.length === 0) {
    return (
      <s-section heading="No suppliers yet">
        <s-banner
          tone="info"
          heading="Add your first supplier to unlock purchase order automation"
        >
          <s-paragraph>
            Suppliers are linked to your products. When a product drops below its
            reorder point, Brim creates a draft purchase order and routes it to the
            right supplier automatically.
          </s-paragraph>
        </s-banner>
        <s-button variant="primary" onClick={() => navigate("/app/suppliers/new")}>
          Add supplier
        </s-button>
      </s-section>
    );
  }

  return (
    <s-section>
      <s-table>
        <s-table-header-row>
          <s-table-header>Name</s-table-header>
          <s-table-header>Email</s-table-header>
          <s-table-header>Phone</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {suppliers.map((supplier) => (
            <s-table-row
              key={supplier.id}
              clickDelegate={`supplier-link-${supplier.id}`}
            >
              <s-table-cell>
                <s-link
                  id={`supplier-link-${supplier.id}`}
                  href={`/app/suppliers/${supplier.id}`}
                >
                  {supplier.name}
                </s-link>
              </s-table-cell>
              <s-table-cell>{supplier.email}</s-table-cell>
              <s-table-cell>{supplier.phone ?? "—"}</s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>
    </s-section>
  );
}
