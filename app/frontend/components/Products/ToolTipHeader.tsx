import { useId } from "react";

interface ToolTipHeaderProps {
  label: string;
  tooltip: string;
  /** When true, renders a required asterisk between the label and the tooltip icon. */
  required?: boolean;
}

/**
 * Label with a small question-circle style icon that shows a Polaris tooltip on hover.
 * Order: label → optional asterisk → tooltip icon (to the right of asterisk). Icon is small and dark.
 */
export function TooltipHeader({ label, tooltip, required }: ToolTipHeaderProps) {
  const id = useId().replace(/:/g, "-");

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span>{label}</span>
      {required && (
        <span style={{ fontSize: 12, color: "#d82c0d", fontWeight: 500 }}>*</span>
      )}
      <s-tooltip id={id}>
        <s-text>{tooltip}</s-text>
      </s-tooltip>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 12,
          height: 12,
          borderRadius: "50%",
          border: "1.5px solid #5c5f62",
          color: "#5c5f62",
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1,
          flexShrink: 0,
          cursor: "default",
        }}
      >
        <s-text interestFor={id} color="subdued">
          ?
        </s-text>
      </span>
    </span>
  );
}
