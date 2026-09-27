import { Check, Clock3, Video, MonitorPlay, Package, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDurationMinutes, formatEGP } from '../lib/businessFormat';
import { registrationValidityLabel } from '../lib/registrationPolicy';
import PackageBookingTerms from './PackageBookingTerms';
import './PackageGuide.css';

const groups = [
  { kind: 'hourly', title: 'التصوير بالساعة', note: 'hourly_note', Icon: Clock3 },
  { kind: 'daily', title: 'الباقات اليومية', note: 'daily_note', Icon: CalendarDays },
  { kind: 'monthly', title: 'الباقات الشهرية', note: 'monthly_note', Icon: Package },
];

export default function PackageGuideView({ data }) {
  const { content, services = [], booking_terms } = data;
  return <article className="package-guide" dir="rtl">
    <header className="package-guide-hero"><span>Multi Task Agency · كل التفاصيل قبل الحجز</span><h2>{content.title}</h2><p>{content.subtitle}</p></header>
    <section className="package-guide-packages" aria-label="أنظمة التصوير والباقات">
      <p className="package-guide-intro">{content.packages_intro}</p>
      <div className="package-guide-included"><strong>كل الباقات تشمل</strong><ul>{content.included_features.map((feature, index) => <li key={index}><Check aria-hidden="true"/>{feature}</li>)}</ul></div>
      {!services.length && <p className="package-guide-notice">لا توجد باقات متاحة حاليًا. تواصل مع الإدارة لمعرفة الخيارات المتوفرة.</p>}
      {groups.map(({ kind, title, note, Icon }) => {
        const rows = services.filter(service => service.kind === kind);
        if (!rows.length) return null;
        return <section className="package-guide-group" key={kind}>
          <header><Icon aria-hidden="true"/><div><h3>{title}</h3><p>{content[note]}</p></div></header>
          <div className="package-guide-price-grid">{rows.map(service => <article className="package-guide-price" key={service.id}>
            <h4>{service.name}</h4>
            <p className="package-guide-price-label">إجمالي السعر</p><strong className="package-guide-amount"><bdi>{formatEGP(service.price)}</bdi></strong>
            {Number(service.total_hours) > 0 && <p className="package-guide-per-hour"><bdi>{formatEGP(Number(service.price) / Number(service.total_hours))}</bdi> / ساعة</p>}
            <dl><div><dt>ساعات التصوير</dt><dd>{formatDurationMinutes(Number(service.total_hours) * 60)}</dd></div><div><dt>الصلاحية</dt><dd>{registrationValidityLabel(service)}</dd></div><div><dt>مقدم الحجز{service.deposit_percent != null && <> ({Number(service.deposit_percent)}%)</>}</dt><dd><bdi>{formatEGP(service.deposit_amount)}</bdi></dd></div></dl>
            {service.payment_due_text && <p className="package-guide-description">{service.payment_due_text}</p>}
            {content.package_descriptions?.[String(service.id)] && <p className="package-guide-description">{content.package_descriptions[String(service.id)]}</p>}
          </article>)}</div>
        </section>;
      })}
    </section>
    <section className="package-guide-section"><div className="package-guide-section-heading"><MonitorPlay aria-hidden="true"/><div><h3>{content.studio_title}</h3><p>{content.studio_intro}</p></div></div><dl className="package-guide-features">{content.studio_features.map((feature, index) => <div key={index}><dt>{feature.title}</dt><dd>{feature.description}</dd></div>)}</dl></section>
    <section className="package-guide-section"><div className="package-guide-section-heading"><Video aria-hidden="true"/><div><h3>{content.delivery_title}</h3><p>{content.delivery_intro}</p></div></div><div className="package-guide-delivery-grid">{content.delivery_options.map((option, index) => <article key={index}><span>{String(index + 1).padStart(2, '0')}</span><h4>{option.title}</h4><strong>{option.timeframe}</strong><p>{option.description.replace('مواعيد الاستلام الموضحة أدناه عند توفرها', 'مواعيد الاستلام الموضحة في صفحة «التسليمات»')}</p></article>)}</div><p className="package-guide-notice">مواعيد الاستلام قابلة للتغيير. يُرجى مراجعة <Link to="/dashboard?tab=videos">صفحة التسليمات</Link> قبل التوجه إلى مقر الشركة.</p></section>
    <PackageBookingTerms terms={booking_terms}/>
    <p className="package-guide-footer-note">{content.footer_note}</p>
  </article>;
}
