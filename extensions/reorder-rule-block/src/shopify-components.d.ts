type Props = Record<string, unknown>;

declare const shopify: {
  data: {
    selected: { id: string }[];
  };
  navigation: {
    navigate: (url: string) => void;
  };
};

declare namespace preact.JSX {
  interface HTMLAttributes<T> {
    interestFor?: string;
  }
  interface IntrinsicElements {
    "s-admin-block": Props;
    "s-admin-action": Props;
    "s-banner": Props;
    "s-button": Props;
    "s-divider": Props;
    "s-link": Props;
    "s-number-field": Props;
    "s-option": Props;
    "s-paragraph": Props;
    "s-select": Props;
    "s-spinner": Props;
    "s-stack": Props;
    "s-text": Props;
    "s-thumbnail": Props;
    "s-badge": Props;
    "s-box": Props;
    "s-tooltip": Props;
    "s-clickable": Props;
    "s-icon": Props;
  }
}
