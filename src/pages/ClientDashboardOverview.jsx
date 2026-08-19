import { AlarmClock, CalendarDays, CircleDollarSign, Clock3, FolderKanban, Gift, MapPin, Package, ReceiptText } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { calculateDurationMinutes, formatBookingDate, formatClientPoints, formatDurationMinutes, formatEGP, formatPackageQuantity, formatTime12, packageQuantitySummary, remainingCalendarDays } from '../lib/businessFormat';
import { PACKAGE_PAYMENT_DUE_MESSAGE, packagePaymentDueItems, piastresToMoney } from '../lib/clientFinanceSummary';
import ClientAppointmentLiveStatus from './ClientAppointmentLiveStatus';

const STATUS_META = {
  pending: { label: 'بانتظار التأكيد', tone: 'waiting' }, confirmed: { label: 'مؤكد', tone: 'success' },
  alternative_proposed: { label: 'موعد بديل مقترح', tone: 'info' }, rejected: { label: 'مرفوض', tone: 'danger' },
  cancel_requested: { label: 'طلب الإلغاء قيد المراجعة', tone: 'waiting' }, late_cancel_requested: { label: 'طلب إلغاء متأخر', tone: 'danger' },
  completed: { label: 'مكتمل', tone: 'success' }, in_progress: { label: 'جارٍ الآن', tone: 'info' },
};

const safeClientDate = value => value ? formatBookingDate(String(value).slice(0, 10)) : '';
const validityLabel = mode => mode === 'shooting_day' ? 'يوم التصوير' : 'من أول حجز';

function EmptySection({ title, text, onAction, actionLabel }) {
  return <div className="client-simple-empty"><Package aria-hidden="true"/><strong>{title}</strong><p>{text}</p>{onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}</div>;
}

export function ClientPaymentDueAlarm({ packages = [], onNavigate }) {
  const duePackages = packagePaymentDueItems(packages);
  if (!duePackages.length) return null;
  const totalRemaining = duePackages.reduce((sum, pkg) => sum + pkg.outstandingPiastres, 0);
  return <section className="client-payment-due-alarm" role="alert" aria-live="polite" aria-atomic="true" aria-labelledby="client-payment-due-title">
    <span className="client-payment-due-alarm__icon" aria-hidden="true"><AlarmClock/></span>
    <div className="client-payment-due-alarm__content"><span>تنبيه استحقاق مالي</span><h2 id="client-payment-due-title">{PACKAGE_PAYMENT_DUE_MESSAGE}</h2><ul aria-label="الباقات المستحقة">{duePackages.map(pkg => <li key={pkg.id}><strong>{pkg.name}</strong><span>المتبقي {formatEGP(piastresToMoney(pkg.outstandingPiastres))}</span></li>)}</ul>{duePackages.length > 1 && <p>إجمالي المستحق الآن: <strong>{formatEGP(piastresToMoney(totalRemaining))}</strong></p>}</div>
    <button type="button" onClick={() => onNavigate('finance')}><CircleDollarSign aria-hidden="true"/>الذهاب إلى المالية</button>
  </section>;
}

export function ClientPackageCards({ packages = [], points = 0, onBookPackage, heading = true }) {
  const cards = packages.map(pkg => {
    const quantity = packageQuantitySummary(pkg);
    const totalPrice = Number(pkg.total_price || 0) + Number(pkg.overage_amount || 0);
    return { ...pkg, ...quantity, totalPrice, outstanding: Math.max(0, totalPrice - Number(pkg.paid_amount || 0)) };
  });
  return <section className="client-packages-home" aria-labelledby="current-packages-title">
    {heading && <header className="client-simple-section-head"><div><span>باقاتك في مكان واحد</span><h2 id="current-packages-title">تفاصيل الباقات والخدمات</h2><p>الساعات والاستخدام والتكلفة والمتبقي بشكل واضح.</p></div></header>}
    {cards.length ? <div className="client-simple-package-grid">{cards.map(pkg => <article className="client-simple-package-card" key={pkg.id}>
      <header><div><span className="client-package-status">باقة فعالة</span><h3>{pkg.name}</h3></div><small>#{pkg.id}</small></header>
      <div className="client-package-metrics" aria-label={`ملخص ${pkg.name}`}><div><span>إجمالي الباقة</span><strong>{formatPackageQuantity(pkg.purchased, pkg.billing_unit)}</strong></div><div><span>المستخدم</span><strong>{formatPackageQuantity(pkg.consumed, pkg.billing_unit)}</strong></div><div><span>إجمالي التكلفة</span><strong>{formatEGP(pkg.totalPrice)}</strong></div><div className={pkg.outstanding ? 'is-due' : 'is-paid'}><span>المتبقي</span><strong>{formatEGP(pkg.outstanding)}</strong></div></div>
      <div className="client-package-validity client-package-validity--simple"><CalendarDays aria-hidden="true"/><span>{pkg.expires_at ? <><b>{remainingCalendarDays(pkg.expires_at).toLocaleString('ar-EG-u-nu-latn')} يوم متبقي</b><small>{safeClientDate(pkg.starts_at)} — {safeClientDate(pkg.expires_at)} · الجمعة محسوبة</small></> : <><b>بانتظار أول حجز</b><small>تبدأ الصلاحية تلقائيًا عند تأكيده</small></>}</span></div>
      <details className="client-package-disclosure"><summary>كل تفاصيل الباقة</summary><div className="client-package-detail-body"><dl><div><dt>إجمالي الرصيد</dt><dd>{formatPackageQuantity(pkg.purchased, pkg.billing_unit)}</dd></div><div><dt>المستخدم</dt><dd>{formatPackageQuantity(pkg.consumed, pkg.billing_unit)}</dd></div><div><dt>محجوز لمواعيد</dt><dd>{formatPackageQuantity(pkg.held, pkg.billing_unit)}</dd></div><div><dt>متاح الآن</dt><dd>{formatPackageQuantity(pkg.available, pkg.billing_unit)}</dd></div><div><dt>المدفوع</dt><dd>{formatEGP(pkg.paid_amount)}</dd></div><div><dt>المتبقي المالي</dt><dd>{formatEGP(pkg.outstanding)}</dd></div><div><dt>بداية الصلاحية</dt><dd>{safeClientDate(pkg.starts_at) || 'عند أول حجز'}</dd></div><div><dt>نهاية الصلاحية</dt><dd>{safeClientDate(pkg.expires_at) || 'تُحسب تلقائيًا'}</dd></div><div><dt>نظام الصلاحية</dt><dd>{validityLabel(pkg.validity_mode_snapshot)}</dd></div><div><dt>نقاط حسابك</dt><dd>{formatClientPoints(points)} نقطة</dd></div></dl>{pkg.client_notes && <p className="client-package-note"><b>ملاحظة لك</b>{pkg.client_notes}</p>}</div></details>
      {onBookPackage && <button className="client-package-book" type="button" onClick={() => onBookPackage(pkg.id)}>احجز من هذه الباقة</button>}
    </article>)}</div> : <EmptySection title="لا توجد باقة فعالة حاليًا" text="ستظهر باقاتك هنا فور إضافتها إلى حسابك."/>}
  </section>;
}

function ClientActiveServices({ projects = [] }) {
  const active = projects.filter(project => ['planning', 'active', 'on_hold'].includes(project.status));
  if (!active.length) return null;
  return <section className="client-home-services" aria-labelledby="client-home-services-title"><header className="client-simple-section-head"><div><span>الخدمات المخصصة</span><h2 id="client-home-services-title">خدماتك الحالية</h2><p>المرحلة والتقدم والحساب في بطاقة واحدة.</p></div></header><div className="client-home-service-list">{active.map(project => {
    const progress = Math.max(0, Math.min(100, Number(project.progress_percent || 0)));
    const currentStage = (project.milestones || []).find(stage => ['active', 'in_progress'].includes(stage.status)) || (project.milestones || []).find(stage => !['completed', 'done'].includes(stage.status));
    const total = Number(project.financial?.total ?? project.agreed_price ?? 0); const paid = Number(project.financial?.paid ?? project.paid_amount ?? 0); const remaining = Number(project.financial?.remaining ?? Math.max(0, total - paid));
    return <article className="client-home-service-card" key={project.id}><span className="client-home-service-card__icon"><FolderKanban aria-hidden="true"/></span><div className="client-home-service-card__main"><small>{project.service_label || project.service_type || 'خدمة مخصصة'}</small><h3>{project.name}</h3><div className="client-home-service-progress" aria-label={`نسبة التقدم ${progress}%`}><i style={{ width: `${progress}%` }}/></div><p>المرحلة الحالية: <strong>{currentStage?.title || 'قيد المتابعة'}</strong></p></div><b className="client-home-service-percent">{progress.toLocaleString('ar-EG-u-nu-latn')}%</b><details className="client-home-service-details"><summary>تفاصيل الخدمة</summary><dl><div><dt>قيمة الاتفاق</dt><dd>{formatEGP(total)}</dd></div><div><dt>المدفوع</dt><dd>{formatEGP(paid)}</dd></div><div><dt>المتبقي</dt><dd className={remaining ? 'is-due' : ''}>{formatEGP(remaining)}</dd></div><div><dt>موعد التسليم</dt><dd>{safeClientDate(project.due_at) || 'غير محدد'}</dd></div></dl></details></article>;
  })}</div></section>;
}

export default function ClientDashboardOverview({ client, activePackages, upcomingBookings, projects = [], sessionByBookingId, sessionServerOffset, onNavigate, onBookPackage }) {
  const nextBooking = upcomingBookings[0]; const activeSession = nextBooking ? sessionByBookingId?.get(Number(nextBooking.id)) : null;
  const nextStatus = STATUS_META[nextBooking?.status] || { label: nextBooking?.status || 'غير محدد', tone: 'neutral' };
  const resourceLabel = nextBooking?.resource_name || nextBooking?.studio_name || nextBooking?.location || (nextBooking?.resource_id ? `استديو #${nextBooking.resource_id}` : 'استديو الشركة');
  const nextPackage = activePackages.find(pkg => Number(pkg.id) === Number(nextBooking?.client_package_id)); const duration = calculateDurationMinutes(nextBooking?.start_time, nextBooking?.end_time);
  return <section className="client-view client-simple-overview" aria-label="ملخص حساب العميل">
    <section className={`client-next-home${activeSession ? ' client-next-home--live' : ''}`} aria-labelledby="next-booking-title"><header className="client-simple-section-head client-simple-section-head--action"><div><span>{activeSession ? 'الاستديو يعمل الآن' : 'موعدك التالي'}</span><h2 id="next-booking-title" aria-live="polite">{activeSession ? 'تم بدء جلسة التصوير' : 'موعد التصوير القادم'}</h2></div>{!activeSession && <button type="button" onClick={() => onNavigate('schedule')}>كل المواعيد</button>}</header>{nextBooking ? <article className={`client-simple-next-card${activeSession ? ' client-simple-next-card--live' : ''}`} data-booking-id={nextBooking.id}><div className="client-simple-date-block"><span>{format(new Date(`${nextBooking.date}T12:00`), 'EEEE', { locale: ar })}</span><strong>{format(new Date(`${nextBooking.date}T12:00`), 'd')}</strong><small>{format(new Date(`${nextBooking.date}T12:00`), 'MMMM yyyy', { locale: ar })}</small></div><div className="client-simple-next-details">{activeSession ? <span className="client-status client-status--live">جاري التصوير</span> : <span className={`client-status client-status--${nextStatus.tone}`}>{nextStatus.label}</span>}<h3>{nextPackage?.name || nextBooking.service}</h3><p><CalendarDays/>{format(new Date(`${nextBooking.date}T12:00`), 'EEEE، d MMMM yyyy', { locale: ar })}</p><p><Clock3/>{formatTime12(nextBooking.start_time)} – {formatTime12(nextBooking.end_time)} · مدة الحجز {formatDurationMinutes(duration)}</p><p><MapPin/>{resourceLabel}</p>{nextPackage && <p><Package/>الخدمة: {nextBooking.service}</p>}{activeSession && <ClientAppointmentLiveStatus session={activeSession} serverOffset={sessionServerOffset}/>}</div>{!activeSession && <button type="button" onClick={() => onNavigate('schedule')}>عرض الموعد</button>}</article> : <EmptySection title="لا يوجد موعد قادم" text="يمكنك اختيار باقتك وطلب موعد في أقل من دقيقة." onAction={() => onNavigate('schedule')} actionLabel="طلب حجز جديد"/>}</section>
    <ClientPaymentDueAlarm packages={activePackages} onNavigate={onNavigate}/><ClientPackageCards packages={activePackages} points={client?.points} onBookPackage={onBookPackage}/><ClientActiveServices projects={projects}/><nav className="client-home-quick-links" aria-label="روابط إضافية"><button type="button" onClick={() => onNavigate('schedule')}><CalendarDays/><span><b>حجز موعد</b><small>اختر اليوم والوقت</small></span></button><button type="button" onClick={() => onNavigate('offers')}><ReceiptText/><span><b>عروض الشركة</b><small>اشترك في عرض متاح</small></span></button><button type="button" onClick={() => onNavigate('finance')}><Gift/><span><b>المدفوعات</b><small>الحالة المالية وإثبات التحويل</small></span></button></nav>
  </section>;
}
