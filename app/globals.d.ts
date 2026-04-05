declare module "*.css";

declare namespace React {
  interface HTMLAttributes<T> {
    interestFor?: string;
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    "s-clickable": React.HTMLAttributes<HTMLElement> & {
      interestFor?: string;
      style?: React.CSSProperties;
      children?: React.ReactNode;
    };
  }
}
