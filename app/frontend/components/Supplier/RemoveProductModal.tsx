type Props = {
  modalId: string;
  productName: string;
  onConfirm: () => void;
};

export default function RemoveProductModal({ modalId, productName, onConfirm }: Props) {
  return (
    <s-modal id={modalId} heading="Remove product?" size="small">
      <s-paragraph>
        Remove <s-text type="strong">{productName}</s-text> from this supplier?
        The reorder rule will be deactivated.
      </s-paragraph>

      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        commandFor={modalId}
        command="--hide"
        onClick={onConfirm}
      >
        Remove
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
