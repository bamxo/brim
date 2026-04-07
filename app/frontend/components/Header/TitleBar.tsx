type Breadcrumb = { label: string; href: string };

type TitleBarProps = {
  heading: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  children?: React.ReactNode;
};

export default function TitleBar({ heading, subtitle, breadcrumbs, children }: TitleBarProps) {
  return (
    <s-page heading={heading}>
      {breadcrumbs?.map((crumb, i) => {
        const isLast = i === (breadcrumbs.length - 1);
        return (
          <s-link key={crumb.href} slot="breadcrumb-actions" href={crumb.href}>
            {isLast ? <s-text type="strong">{crumb.label}</s-text> : crumb.label}
          </s-link>
        );
      })}
      {subtitle && (
        <s-paragraph color="subdued">{subtitle}</s-paragraph>
      )}
      {children}
    </s-page>
  );
}
