import { CalendarDays, Clock3, Gift, History, MapPin, Package, ReceiptText, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatBookingDate, formatEGP, formatPackageQuantity, formatTime12, packageQuantitySummary, remainingCalendarDays } from '../lib/businessFormat';
import ClientAppointmentLiveStatus from './ClientAppointmentLiveStatus';

const STATUS_META = {
  pending: { label: 'بانتظار التأكيد', tone: 'waiting' }, confirmed: { label: 'مؤكد', tone: 'success' },
  alternative_proposed: { label: 'موعد بديل مقترح', tone: 'info' }, rejected: { label: 'مرفوض', tone: 'danger' },
  cancel_requested: { label: 'طلب الإلغاء قيد المراجعة', tone: 'waiting' }, late_cancel_requested: { label: 'طلب إلغاء متأخر', tone: 'danger' },
  completed: { label: 'مكتمل', tone: 'success' }, in_progress: { label: 'جارٍ الآن', tone: 'info' },
};

const clientPointsLabel = value => {
  const points = Number(value);
  return (Number.isFinite(points) ? points : 0).toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 2 });
};

const safeClientDate = value => value ? formatBookingDate(String(value).slice(0, 10)) : '';
const validityLabel = mode => mode === 'shooting_day' ? 'يوم التصوير' : 'من أول حجز';

function EmptySection({ title, text, onAction, actionLabel }) {
  return <div className="client-simple-empty"><Package aria-hidden="true"/><strong>{title}</strong><p>{text}</p>{onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}</div>;
}

export function ClientPointsCard({ client, compact = false }) {
  const updated = safeClientDate(client?.points_updated_at);
  return <section className={`client-points-card${compact ? ' client-points-card--compact' : ''}`} aria-label="نقاط حسابك">
    <span className="client-points-card__icon"><Sparkles aria-hidden="true"/></span>
    <div><small>نقاط حسابك</small><strong>{clientPointsLabel(client?.points)} <em>نقطة</em></strong>{updated && <p>آخر تحديث {updated}</p>}</div>
    <span className="client-points-card__note">رصيدك الحالي المسجل في حسابك</span>
  </section>;
}

export function ClientPackageCards({ packages = [], points = 0, onBookPackage, heading = true }) {
  const cards = packages.map(pkg => {
    const quantity = packageQuantitySummary(pkg);
    const totalPrice = Number(pkg.total_price || 0) + Number(pkg.overage_amount || 0);
    return { ...pkg, ...quantity, totalPrice, outstanding: Math.max(0, totalPrice - Number(pkg.paid_amount || 0)) };
  });
  return <section className="client-packages-home" aria-labelledby="current-packages-title">
    {heading && <header className="client-simple-section-head"><div><span>كل باقاتك في مكان واحد</span><h2 id="current-packages-title">باقاتك الحالية</h2><p>الرصيد والصلاحية والسداد أولًا، وباقي التفاصيل عند الحاجة.</p></div></header>}
    {cards.length ? <div className="client-simple-package-grid">{cards.map(pkg => <article className="client-simple-package-card" key={pkg.id}>
      <header><div><span className="client-package-status">باقة فعالة</span><h3>{pkg.name}</h3></div><small>#{pkg.id}</small></header>
      <div className="client-package-face">
        <div className="client-package-balance"><span>متاح للحجز</span><strong>{formatPackageQuantity(pkg.available, pkg.billing_unit)}</strong><small>من {formatPackageQuantity(pkg.purchased, pkg.billing_unit)}</small></div>
        <div className="client-package-validity"><CalendarDays aria-hidden="true"/><span>{pkg.expires_at ? <><b>{remainingCalendarDays(pkg.expires_at).toLocaleString('ar-EG-u-nu-latn')}</b> يوم متبقي<small>{safeClientDate(pkg.starts_at)} — {safeClientDate(pkg.expires_at)} · الجمعة محسوبة</small></> : <><b>بانتظار أول حجز</b><small>تبدأ الصلاحية تلقائيًا عند تأكيده</small></>}</span></div>
      </div>
      <div className="client-package-money"><span>المدفوع <b>{formatEGP(pkg.paid_amount)}</b></span><span>المتبقي <b className={pkg.outstanding ? 'is-due' : ''}>{formatEGP(pkg.outstanding)}</b></span><span>نقاط حسابك <b>{clientPointsLabel(points)}</b></span></div>
      <details className="client-package-disclosure"><summary>تفاصيل الباقة</summary><div className="client-package-detail-body">
        <dl>
          <div><dt>إجمالي الرصيد</dt><dd>{formatPackageQuantity(pkg.purchased, pkg.billing_unit)}</dd></div>
          <div><dt>المستخدم</dt><dd>{formatPackageQuantity(pkg.consumed, pkg.billing_unit)}</dd></div>
          <div><dt>محجوز لمواعيد قادمة</dt><dd>{formatPackageQuantity(pkg.held, pkg.billing_unit)}</dd></div>
          <div><dt>متاح الآن</dt><dd>{formatPackageQuantity(pkg.available, pkg.billing_unit)}</dd></div>
          <div><dt>حد السداد</dt><dd>{formatPackageQuantity(pkg.payment_due_quantity || 0, pkg.billing_unit)}</dd></div>
          <div><dt>قيمة الباقة</dt><dd>{formatEGP(pkg.total_price)}</dd></div>
          <div><dt>إضافات الجلسات</dt><dd>{formatEGP(pkg.overage_amount)}</dd></div>
          <div><dt>المدفوع</dt><dd>{formatEGP(pkg.paid_amount)}</dd></div>
          <div><dt>المتبقي المالي</dt><dd>{formatEGP(pkg.outstanding)}</dd></div>
          <div><dt>الدفعة المقدمة</dt><dd>{Number(pkg.deposit_percent_snapshot || 0).toLocaleString('ar-EG-u-nu-latn')}%</dd></div>
          <div><dt>بداية الصلاحية</dt><dd>{safeClientDate(pkg.starts_at) || 'عند أول حجز'}</dd></div>
          <div><dt>نهاية الصلاحية</dt><dd>{safeClientDate(pkg.expires_at) || 'تُحسب تلقائيًا'}</dd></div>
          <div><dt>نظام الصلاحية</dt><dd>{validityLabel(pkg.validity_mode_snapshot)}</dd></div>
          <div><dt>نقاط حسابك</dt><dd>{clientPointsLabel(points)} نقطة</dd></div>
        </dl>
        {pkg.client_notes && <p className="client-package-note"><b>ملاحظة لك</b>{pkg.client_notes}</p>}
      </div></details>
      {onBookPackage && <button className="client-package-book" type="button" onClick={() => onBookPackage(pkg.id)}>احجز من هذه الباقة</button>}
    </article>)}</div> : <EmptySection title="لا توجد باقة فعالة حاليًا" text="ستظهر باقاتك هنا فور إضافتها إلى حسابك."/>}
  </section>;
}

export default function ClientDashboardOverview({ client, activePackages, upcomingBookings, sessionByBookingId, sessionServerOffset, onNavigate, onBookPackage }) {
  const nextBooking = upcomingBookings[0];
  const activeSession = nextBooking ? sessionByBookingId?.get(Number(nextBooking.id)) : null;
  const nextStatus = STATUS_META[nextBooking?.status] || { label: nextBooking?.status || 'غير محدد', tone: 'neutral' };
  const resourceLabel = nextBooking?.resource_name || nextBooking?.studio_name || nextBooking?.location || (nextBooking?.resource_id ? `استديو #${nextBooking.resource_id}` : 'استديو الشركة');
  return <section className="client-view client-simple-overview" aria-label="ملخص حساب العميل">
    <ClientPointsCard client={client}/>
    <ClientPackageCards packages={activePackages} points={client?.points} onBookPackage={onBookPackage}/>
    <section className={`client-next-home${activeSession ? ' client-next-home--live' : ''}`} aria-labelledby="next-booking-title">
      <header className="client-simple-section-head client-simple-section-head--action"><div><span>{activeSession ? 'الاستديو يعمل الآن' : 'موعدك التالي'}</span><h2 id="next-booking-title" aria-live="polite">{activeSession ? 'تم بدء جلسة التصوير' : 'الموعد القادم'}</h2></div>{!activeSession && <button type="button" onClick={() => onNavigate('schedule')}>كل المواعيد</button>}</header>
      {nextBooking ? <article className={`client-simple-next-card${activeSession ? ' client-simple-next-card--live' : ''}`} data-booking-id={nextBooking.id}>
        <div className="client-simple-date-block"><span>{format(new Date(`${nextBooking.date}T12:00`), 'EEEE', { locale: ar })}</span><strong>{format(new Date(`${nextBooking.date}T12:00`), 'd')}</strong><small>{format(new Date(`${nextBooking.date}T12:00`), 'MMMM', { locale: ar })}</small></div>
        <div className="client-simple-next-details">{activeSession ? <span className="client-status client-status--live">جاري التصوير</span> : <span className={`client-status client-status--${nextStatus.tone}`}>{nextStatus.label}</span>}<h3>{nextBooking.service}</h3><p><CalendarDays/>{formatBookingDate(nextBooking.date)}</p><p><Clock3/>{formatTime12(nextBooking.start_time)} – {formatTime12(nextBooking.end_time)}</p><p><MapPin/>{resourceLabel}</p>{activeSession && <ClientAppointmentLiveStatus session={activeSession} serverOffset={sessionServerOffset}/>}</div>
        {!activeSession && <button type="button" onClick={() => onNavigate('schedule')}>عرض الموعد</button>}
      </article> : <EmptySection title="لا يوجد موعد قادم" text="يمكنك اختيار باقتك وطلب موعد في أقل من دقيقة." onAction={() => onNavigate('schedule')} actionLabel="طلب حجز جديد"/>}
    </section>
    <nav className="client-home-quick-links" aria-label="روابط إضافية"><button type="button" onClick={() => onNavigate('history')}><History/><span><b>سجل الخدمات</b><small>كل ما تم تنفيذه سابقًا</small></span></button><button type="button" onClick={() => onNavigate('offers')}><ReceiptText/><span><b>العروض</b><small>راجع عروضك الخاصة</small></span></button><button type="button" onClick={() => onNavigate('finance')}><Gift/><span><b>المدفوعات</b><small>الفواتير وإثباتات التحويل</small></span></button></nav>
  </section>;
}
