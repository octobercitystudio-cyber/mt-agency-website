import { CUSTOM_SERVICES } from './customServices';

export default function CustomServiceCatalog({ selected = 'all', onSelect, onCreate, canManage }) {
  return <section className="service-catalog" aria-labelledby="service-catalog-title">
    <header>
      <div><span>خدمات مرنة خارج باقات الاستوديو</span><h2 id="service-catalog-title">ماذا نُنتج الآن؟</h2></div>
      <p>اختر نوع الخدمة لتصفية المشروعات، أو ابدأ مشروعًا جديدًا بإعداداته المناسبة.</p>
    </header>
    <div className="service-mosaic" role="list">
      {Object.entries(CUSTOM_SERVICES).map(([key, service], index) => {
        const Icon = service.icon;
        return <article key={key} role="listitem" className={`${selected === key ? 'selected' : ''} service-tile-${index + 1}`}>
          <button type="button" onClick={() => onSelect?.(selected === key ? 'all' : key)} aria-pressed={selected === key}>
            <span className="service-icon"><Icon/></span>
            <span className="service-copy"><strong>{service.label}</strong><small>{service.hint}</small></span>
          </button>
          {canManage && <button type="button" className="service-quick-add" onClick={() => onCreate?.(key)} aria-label={`إنشاء مشروع ${service.label}`}>+</button>}
        </article>;
      })}
    </div>
  </section>;
}
