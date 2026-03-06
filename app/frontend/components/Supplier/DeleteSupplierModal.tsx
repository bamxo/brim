type Props = {
  modalId: string;
  supplierName: string;
  onConfirm: () => void;
};

export default function DeleteModal({ modalId, supplierName, onConfirm }: Props) {
  return (
    <s-modal id={modalId} heading="Delete supplier?" size="small">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Permanently delete <s-text type="strong">{supplierName}</s-text>?
        </s-paragraph>
        <s-paragraph>
          This will remove the supplier from all active reorder rules. Historical
          purchase orders will be retained but unlinked. This action cannot be undone.
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
        Delete supplier
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
