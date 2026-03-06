type Props = {
  modalId: string;
  productName: string;
  onConfirm: () => void;
};

export default function ClearRuleModal({ modalId, productName, onConfirm }: Props) {
  return (
    <s-modal id={modalId} heading="Clear reorder rule?" size="small">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Clear the reorder rule for{" "}
          <s-text type="strong">{productName}</s-text>?
        </s-paragraph>
        <s-paragraph>
          This will permanently remove the reorder point, reorder quantity,
          unit cost, and supplier assignment for this product. Brim will stop
          creating purchase orders for it automatically. This action cannot be
          undone.
        </s-paragraph>
      </s-stack>

      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        commandFor={modalId}
        command="--hide"
        onClick={onConfirm}
      >
        Clear rule
      </s-button>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        commandFor={modalId}
        command="--hide"
      >
        Cancel
      </s-button>
    </s-modal>
  );
}
