import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { formatBookingDate, formatPackageQuantity, formatTime12, packageQuantitySummary, remainingBusinessDays } from '../lib/businessFormat';

const STATUS_META = {
  pending: { label: 'بانتظار التأكيد', tone: 'waiting' },
  confirmed: { label: 'مؤكد', tone: 'success' },
  alternative_proposed: { label: 'موعد بديل مقترح', tone: 'info' },
  rejected: { label: 'مرفوض', tone: 'danger' },
  cancel_requested: { label: 'طلب الإلغاء قيد المراجعة', tone: 'waiting' },
  late_cancel_requested: { label: 'طلب إلغاء متأخر', tone: 'danger' },
  completed: { label: 'مكتمل', tone: 'success' },
  in_progress: { label: 'جارٍ الآن', tone: 'info' },
};

const numberLabel = value => Number(value || 0).toLocaleString('ar-EG-u-nu-latn');
const unitLabel = billingUnit => billingUnit === 'reel' ? 'ريل' : 'ساعة';

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = event => setReducedMotion(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

function EmptySection({ title, text, onAction, actionLabel }) {
  return <div className="client-simple-empty">
    <Package aria-hidden="true" />
    <strong>{title}</strong>
    <p>{text}</p>
    {onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
  </div>;
}

export default function ClientDashboardOverview({ activePackages, upcomingBookings, onNavigate, onBookPackage }) {
  const reducedMotion = useReducedMotion();

  const packageCards = useMemo(() => activePackages.map(pkg => {
    const summary = packageQuantitySummary(pkg);
    const total = summary.purchased;
    const held = summary.held;
    const consumed = summary.consumed;
    const remaining = summary.remaining;
    const available = summary.available;
    const remainingPercent = total ? Math.round((remaining / total) * 100) : 0;
    return {
      ...pkg,
      total,
      held,
      consumed,
      remaining,
      available,
      remainingPercent,
      unit: unitLabel(pkg.billing_unit),
      chart: total ? [
        { name: 'المتبقي', value: remaining || 0.0001 },
        { name: 'المستخدم', value: consumed || 0.0001 },
      ] : [{ name: 'بدون رصيد', value: 1 }],
    };
  }), [activePackages]);

  const nextBooking = upcomingBookings[0];
  const nextStatus = STATUS_META[nextBooking?.status] || { label: nextBooking?.status || 'غير محدد', tone: 'neutral' };

  return <section className="client-view client-simple-overview" aria-label="ملخص حساب العميل">
    <section className="client-packages-home" aria-labelledby="current-packages-title">
      <header className="client-simple-section-head">
        <div>
          <span>رصيدك المتاح</span>
          <h2 id="current-packages-title">باقاتك الحالية</h2>
          <p>كل تفاصيل الباقة أمامك، مع الرصيد المتبقي وموعد الانتهاء.</p>
        </div>
      </header>

      {packageCards.length ? <div className="client-simple-package-grid">
        {packageCards.map(pkg => <article className="client-simple-package-card" key={pkg.id}>
          <header>
            <div><span>باقة فعالة</span><h3>{pkg.name}</h3></div>
            <small>#{pkg.id}</small>
          </header>

          <div className="client-simple-package-body">
            <div className="client-simple-donut" role="img" aria-label={`المتبقي ${numberLabel(pkg.remaining)} ${pkg.unit} من إجمالي ${numberLabel(pkg.total)} ${pkg.unit}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pkg.chart} dataKey="value" nameKey="name" innerRadius="69%" outerRadius="91%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={!reducedMotion}>
                    {pkg.chart.map((entry, index) => <Cell key={entry.name} fill={pkg.total > 0 && index === 0 ? '#a970ff' : '#31263c'} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="client-simple-donut-center"><strong>{numberLabel(pkg.remainingPercent)}%</strong><span>{numberLabel(pkg.remaining)} {pkg.unit} متبقي</span></div>
            </div>

            <dl className="client-simple-package-values">
              <div><dt>إجمالي الباقة</dt><dd>{numberLabel(pkg.total)} {pkg.unit}</dd></div>
              <div><dt>{pkg.billing_unit === 'reel' ? 'تم تنفيذه' : 'تم تصويره'}</dt><dd>{numberLabel(pkg.consumed)} {pkg.unit}</dd></div>
              <div className="is-remaining"><dt>المتبقي غير المستهلك</dt><dd>{formatPackageQuantity(pkg.remaining,pkg.billing_unit)}</dd></div>
              <div className="is-held"><dt>محجوز قادمًا</dt><dd>{formatPackageQuantity(pkg.held,pkg.billing_unit)}</dd></div>
              <div><dt>متاح لحجز جديد</dt><dd>{formatPackageQuantity(pkg.available,pkg.billing_unit)}</dd></div>
            </dl>
          </div>

          <footer>
            <p><CalendarDays aria-hidden="true" /><span>صالحة حتى <strong>{formatBookingDate(pkg.expires_at)}</strong> · {remainingBusinessDays(pkg.expires_at).toLocaleString('ar-EG-u-nu-latn')} يوم عمل، الجمعة مستثناة</span></p>
            <button type="button" onClick={() => onBookPackage(pkg.id)}>احجز من هذه الباقة</button>
          </footer>
        </article>)}
      </div> : <EmptySection title="لا توجد باقة فعالة حاليًا" text="ستظهر تفاصيل الباقة هنا فور إضافتها إلى حسابك." />}
    </section>

    <section className="client-next-home" aria-labelledby="next-booking-title">
      <header className="client-simple-section-head client-simple-section-head--action">
        <div><span>خطوتك التالية</span><h2 id="next-booking-title">موعدك القادم</h2></div>
        <button type="button" onClick={() => onNavigate('schedule')}>عرض المواعيد</button>
      </header>

      {nextBooking ? <article className="client-simple-next-card">
        <div className="client-simple-date-block">
          <span>{format(new Date(`${nextBooking.date}T12:00`), 'EEEE', { locale: ar })}</span>
          <strong>{format(new Date(`${nextBooking.date}T12:00`), 'd')}</strong>
          <small>{format(new Date(`${nextBooking.date}T12:00`), 'MMMM', { locale: ar })}</small>
        </div>
        <div className="client-simple-next-details">
          <span className={`client-status client-status--${nextStatus.tone}`}>{nextStatus.label}</span>
          <h3>{nextBooking.service}</h3>
          <p><CalendarDays aria-hidden="true" />{formatBookingDate(nextBooking.date)}</p>
          <p><Clock3 aria-hidden="true" />{formatTime12(nextBooking.start_time)} – {formatTime12(nextBooking.end_time)}</p>
        </div>
        <button type="button" onClick={() => onNavigate('schedule')}>عرض المواعيد</button>
      </article> : <EmptySection
        title="لا يوجد موعد قادم"
        text="اختر باقتك والوقت المناسب، ثم أرسل طلب الحجز للإدارة."
        onAction={() => onNavigate('schedule')}
        actionLabel="طلب حجز جديد"
      />}
    </section>
  </section>;
}
