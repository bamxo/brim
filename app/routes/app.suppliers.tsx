import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: suppliers, error } = await (supabase as any)
    .from("suppliers")
    .select("id, name, email, phone, lead_time_days, is_active")
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);

  return { suppliers: suppliers ?? [] };
};

type Supplier = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  lead_time_days: number | null;
  is_active: boolean;
};

export default function Suppliers() {
  const { suppliers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <s-page heading="Suppliers">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/suppliers/new")}
      >
        Add supplier
      </s-button>

      {suppliers.length === 0 ? (
        <s-section heading="No suppliers yet">
          <s-paragraph>
            Add your first supplier to start creating purchase orders.
          </s-paragraph>
          <s-button
            variant="primary"
            onClick={() => navigate("/app/suppliers/new")}
          >
            Add supplier
          </s-button>
        </s-section>
      ) : (
        <s-section>
          <s-table>
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Email</s-table-header>
              <s-table-header>Phone</s-table-header>
              <s-table-header>Lead time</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {suppliers.map((supplier: Supplier) => (
                <s-table-row
                  key={supplier.id}
                  clickDelegate={`supplier-link-${supplier.id}`}
                >
                  <s-table-cell>
                    <s-link id={`supplier-link-${supplier.id}`} href={`/app/suppliers/${supplier.id}`}>
                      {supplier.name}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{supplier.email}</s-table-cell>
                  <s-table-cell>{supplier.phone ?? "—"}</s-table-cell>
                  <s-table-cell>
                    {supplier.lead_time_days != null
                      ? `${supplier.lead_time_days} days`
                      : "—"}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
