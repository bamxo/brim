type Props = {
  onClearRule: () => void;
};

export default function DangerZoneSection({ onClearRule }: Props) {
  return (
    <s-section heading="Danger zone" slot="aside">
      <s-paragraph>
        Clears all reorder rule information for this product — including
        supplier, reorder point, quantity, and unit cost. Brim will stop
        creating purchase orders automatically. This action cannot be undone.
      </s-paragraph>
      <s-button tone="critical" onClick={onClearRule}>
        Clear reorder rule
      </s-button>
    </s-section>
  );
}
