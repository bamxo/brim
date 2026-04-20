import TitleBar from "../components/Header/TitleBar";

export default function ForecastsPage() {
  return (
    <TitleBar heading="Forecasts">
      <s-section>
        <s-stack direction="block" gap="base" alignItems="center">
          <s-icon type="inventory" />
          <s-heading>Forecasts coming soon</s-heading>
          <s-paragraph color="subdued">
            Stock forecasting, demand trends, and reorder recommendations will
            appear here.
          </s-paragraph>
        </s-stack>
      </s-section>
    </TitleBar>
  );
}
