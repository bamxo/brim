import { useLoaderData, useNavigate } from "react-router";

type LoaderData = { shopName: string };

export default function DashboardPage() {
  const { shopName } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  return (
    <s-page heading="Dashboard">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/purchase-orders")}
      >
        View purchase orders
      </s-button>

      <s-section heading={`Welcome to Brim, ${shopName}`}>
        <s-paragraph>
          Brim automates your purchase order management. Set up your suppliers
          and configure reorder rules on your products to get started.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" onClick={() => navigate("/app/suppliers")}>
            Add a supplier
          </s-button>
          <s-button onClick={() => navigate("/app/products")}>
            Configure products
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Quick stats" slot="aside">
        <s-paragraph>
          <s-text>Open purchase orders: </s-text>
          <s-text>—</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Suppliers: </s-text>
          <s-text>—</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Products tracked: </s-text>
          <s-text>—</s-text>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
