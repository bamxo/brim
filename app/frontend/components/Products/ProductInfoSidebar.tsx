type Product = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  current_stock: number;
  image_url: string | null;
  last_synced_at: string | null;
};

type BadgeTone = "info" | "auto" | "warning" | "neutral" | "success" | "caution" | "critical";

type Props = {
  product: Product;
  stockTone: BadgeTone;
};

export default function ProductInfoSidebar({ product, stockTone }: Props) {
  return (
    <s-section heading="Product info" slot="aside">
      <s-thumbnail
        src={product.image_url ?? undefined}
        alt={product.title}
        size="large"
      />
      <s-paragraph>
        <s-text>Variant: </s-text>
        <s-text>{product.variant_title ?? "Default"}</s-text>
      </s-paragraph>
      <s-paragraph>
        <s-text>SKU: </s-text>
        <s-text>{product.sku ?? "—"}</s-text>
      </s-paragraph>
      <s-paragraph>
        <s-text>Current stock: </s-text>
        <s-badge tone={stockTone}>{String(product.current_stock)}</s-badge>
      </s-paragraph>
      {product.last_synced_at && (
        <s-paragraph>
          <s-text>Last synced: </s-text>
          <s-text>{new Date(product.last_synced_at).toLocaleString()}</s-text>
        </s-paragraph>
      )}
    </s-section>
  );
}
