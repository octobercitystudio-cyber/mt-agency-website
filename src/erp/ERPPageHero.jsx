const ERPPageHero = ({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  details,
  className = '',
  identityClassName = '',
}) => (
  <header className={`erp-page-hero ${className}`.trim()}>
    <div className={`erp-page-hero__identity ${identityClassName}`.trim()}>
      {eyebrow && (
        <span className="erp-page-hero__eyebrow">
          {Icon && <Icon size={16} aria-hidden="true" />}
          {eyebrow}
        </span>
      )}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="erp-page-hero__actions" aria-label="إجراءات الصفحة">{actions}</div>}
    {details && <aside className="erp-page-hero__details">{details}</aside>}
  </header>
);

export default ERPPageHero;
