type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function ProductSearchBar({ value, onChange }: Props) {
  return (
    <div
      style={{
        border: "1px solid #e1e3e5",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e1e3e5",
          background: "#fafbfb",
        }}
      >
        <input
          type="text"
          placeholder="Search products…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 10px",
            border: "1px solid #c9cccf",
            borderRadius: "6px",
            fontSize: "12px",
            fontFamily: "inherit",
            outline: "none",
            background: "#fff",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
