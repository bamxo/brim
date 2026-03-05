import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  return { shopName: shop.shop_name ?? session.shop };
};

export default function Dashboard() {
  const { shopName } = useLoaderData<typeof loader>();
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

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
