import { useState } from 'react';
import { ArrowLeft, CheckCircle2, AlarmClock, CalendarDays, CircleDollarSign, Clock3, FolderKanban, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { calculateDurationMinutes, formatBookingDate, formatClientPoints, formatDurationMinutes, formatEGP, formatPackageQuantity, formatPackageStatus, effectivePackageStatus, formatTime12, packageQuantitySummary, remainingCalendarDays } from '../lib/businessFormat';
import { buildClientFinanceSummary, PACKAGE_PAYMENT_DUE_MESSAGE, packagePaymentDueItems, piastresToMoney } from '../lib/clientFinanceSummary';
import ClientAppointmentLiveStatus from './ClientAppointmentLiveStatus';
import ClientDashboardDeliveries from './ClientDashboardDeliveries';

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
      <header><div><span className="client-package-status">{formatPackageStatus(effectivePackageStatus(pkg))}</span><h3>{pkg.name}</h3></div><small>#{pkg.id}</small></header>
      <div className="client-package-metrics" aria-label={`ملخص ${pkg.name}`}><div><span>إجمالي الباقة</span><strong>{formatPackageQuantity(pkg.purchased, pkg.billing_unit)}</strong></div><div><span>المستخدم</span><strong>{formatPackageQuantity(pkg.consumed, pkg.billing_unit)}</strong></div><div><span>إجمالي التكلفة</span><strong>{formatEGP(pkg.totalPrice)}</strong></div><div className={pkg.outstanding ? 'is-due' : 'is-paid'}><span>المتبقي</span><strong>{formatEGP(pkg.outstanding)}</strong></div></div>
      <div className="client-package-validity client-package-validity--simple"><CalendarDays aria-hidden="true"/><span>{pkg.expires_at ? <><b>{effectivePackageStatus(pkg) === 'expired' ? 'انتهت الصلاحية' : `${remainingCalendarDays(pkg.expires_at).toLocaleString('ar-EG-u-nu-latn')} يوم متبقي`}</b><small>{safeClientDate(pkg.starts_at)} — {safeClientDate(pkg.expires_at)} · الجمعة محسوبة</small></> : <><b>بانتظار أول حجز</b><small>تبدأ الصلاحية تلقائيًا عند تأكيده</small></>}</span></div>
      <details className="client-package-disclosure"><summary>كل تفاصيل الباقة</summary><div className="client-package-detail-body"><dl><div><dt>إجمالي الرصيد</dt><dd>{formatPackageQuantity(pkg.purchased, pkg.billing_unit)}</dd></div><div><dt>المستخدم</dt><dd>{formatPackageQuantity(pkg.consumed, pkg.billing_unit)}</dd></div><div><dt>محجوز لمواعيد</dt><dd>{formatPackageQuantity(pkg.held, pkg.billing_unit)}</dd></div><div><dt>متاح الآن</dt><dd>{formatPackageQuantity(pkg.available, pkg.billing_unit)}</dd></div><div><dt>المدفوع</dt><dd>{formatEGP(pkg.paid_amount)}</dd></div><div><dt>المتبقي المالي</dt><dd>{formatEGP(pkg.outstanding)}</dd></div><div><dt>بداية الصلاحية</dt><dd>{safeClientDate(pkg.starts_at) || 'عند أول حجز'}</dd></div><div><dt>نهاية الصلاحية</dt><dd>{safeClientDate(pkg.expires_at) || 'تُحسب تلقائيًا'}</dd></div><div><dt>نظام الصلاحية</dt><dd>{validityLabel(pkg.validity_mode_snapshot)}</dd></div><div><dt>نقاط حسابك</dt><dd>{formatClientPoints(points)} نقطة</dd></div></dl>{pkg.client_notes && <p className="client-package-note"><b>ملاحظة لك</b>{pkg.client_notes}</p>}</div></details>
      {onBookPackage && <button disabled={effectivePackageStatus(pkg) !== 'active' || pkg.available <= 0 || !['hour', 'reel'].includes(pkg.billing_unit)} className="client-package-book" type="button" onClick={() => onBookPackage(pkg.id)}>{effectivePackageStatus(pkg) !== 'active' ? 'الباقة غير متاحة للحجز' : pkg.available <= 0 ? 'لا يوجد رصيد متاح للحجز' : 'احجز من هذه الباقة'}</button>}
    </article>)}</div> : <EmptySection title="لا توجد باقة فعالة حاليًا" text="ستظهر باقاتك هنا فور إضافتها إلى حسابك."/>}
  </section>;
}

export function ClientActiveServices({ projects = [] }) {
  const active = projects.filter(project => ['planning', 'active', 'on_hold'].includes(project.status));
  if (!active.length) return null;
  return <section className="client-home-services" aria-labelledby="client-home-services-title"><header className="client-simple-section-head"><div><span>الخدمات المخصصة</span><h2 id="client-home-services-title">خدماتك الحالية</h2><p>المرحلة والتقدم والحساب في بطاقة واحدة.</p></div></header><div className="client-home-service-list">{active.map(project => {
    const progress = Math.max(0, Math.min(100, Number(project.progress_percent || 0)));
    const currentStage = (project.milestones || []).find(stage => ['active', 'in_progress'].includes(stage.status)) || (project.milestones || []).find(stage => !['completed', 'done'].includes(stage.status));
    const total = Number(project.financial?.total ?? project.agreed_price ?? 0); const paid = Number(project.financial?.paid ?? project.paid_amount ?? 0); const remaining = Number(project.financial?.remaining ?? Math.max(0, total - paid));
    return <article className="client-home-service-card" key={project.id}><span className="client-home-service-card__icon"><FolderKanban aria-hidden="true"/></span><div className="client-home-service-card__main"><small>{project.service_label || project.service_type || 'خدمة مخصصة'}</small><h3>{project.name}</h3><div className="client-home-service-progress" aria-label={`نسبة التقدم ${progress}%`}><i style={{ width: `${progress}%` }}/></div><p>المرحلة الحالية: <strong>{currentStage?.title || 'قيد المتابعة'}</strong></p></div><b className="client-home-service-percent">{progress.toLocaleString('ar-EG-u-nu-latn')}%</b><details className="client-home-service-details"><summary>تفاصيل الخدمة</summary><dl><div><dt>قيمة الاتفاق</dt><dd>{formatEGP(total)}</dd></div><div><dt>المدفوع</dt><dd>{formatEGP(paid)}</dd></div><div><dt>المتبقي</dt><dd className={remaining ? 'is-due' : ''}>{formatEGP(remaining)}</dd></div><div><dt>موعد التسليم</dt><dd>{safeClientDate(project.due_at) || 'غير محدد'}</dd></div></dl></details></article>;
  })}</div></section>;
}

const quantityLabel = (pkg, quantity) => formatPackageQuantity(quantity, pkg?.billing_unit);
const packageBookable = pkg => pkg && effectivePackageStatus(pkg) === 'active' && ['hour', 'reel'].includes(pkg.billing_unit) && packageQuantitySummary(pkg).available > 0;

export default function ClientDashboardOverview({ client, activePackages = [], financialPackages = activePackages, invoices = [], upcomingBookings = [], projects = [], sessionByBookingId, sessionServerOffset, onNavigate, onBookPackage, onViewBooking }) {
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const nextBooking = upcomingBookings[0];
  const activeSession = nextBooking ? sessionByBookingId?.get(Number(nextBooking.id)) : null;
  const nextStatus = STATUS_META[nextBooking?.status] || { label: nextBooking?.status || 'غير محدد', tone: 'neutral' };
  const resourceLabel = nextBooking?.resource_name || nextBooking?.studio_name || nextBooking?.location || (nextBooking?.resource_id ? `استديو #${nextBooking.resource_id}` : 'استديو الشركة');
  const nextPackage = financialPackages.find(pkg => Number(pkg.id) === Number(nextBooking?.client_package_id));
  const defaultPackage = (packageBookable(nextPackage) ? nextPackage : activePackages.find(packageBookable)) || activePackages[0] || financialPackages[0];
  const selectedPackage = financialPackages.find(pkg => String(pkg.id) === selectedPackageId) || defaultPackage;
  const quantity = packageQuantitySummary(selectedPackage);
  const canBook = packageBookable(selectedPackage);
  const consumedPercent = quantity.purchased > 0 ? Math.min(100, quantity.consumed / quantity.purchased * 100) : 0;
  const heldPercent = quantity.purchased > 0 ? Math.min(100 - consumedPercent, quantity.held / quantity.purchased * 100) : 0;
  const availablePercent = quantity.purchased > 0 ? Math.max(0, 100 - consumedPercent - heldPercent) : 0;
  const activeBalance = selectedPackage && effectivePackageStatus(selectedPackage) === 'active';
  const finance = buildClientFinanceSummary(financialPackages, invoices);
  const dueCount = finance.rows.filter(row => row.dueNow && row.remainingPiastres > 0).length;
  const viewBooking = booking => onViewBooking ? onViewBooking(booking.id) : onNavigate('schedule');
  return <section className="client-view glance-overview" aria-label="ملخص حساب العميل">
    <div className="glance-top-grid">
      <section className={`glance-card glance-next${activeSession ? ' glance-next--live' : ''}`} aria-labelledby="next-booking-title">
        <header className="glance-section-head"><h2 id="next-booking-title">{activeSession ? 'جلسة التصوير جارية الآن' : 'موعد التصوير القادم'}</h2>{nextBooking && <span className={`client-status client-status--${activeSession ? 'live' : nextStatus.tone}`}>{activeSession ? 'جاري التصوير' : nextStatus.label}</span>}</header>
        {nextBooking ? <><article className="glance-next-main" data-booking-id={nextBooking.id}>
          <div className="glance-date-block"><span>{format(new Date(`${nextBooking.date}T12:00`), 'EEEE', { locale: ar })}</span><strong>{format(new Date(`${nextBooking.date}T12:00`), 'd')}</strong><small>{format(new Date(`${nextBooking.date}T12:00`), 'MMMM', { locale: ar })}</small></div>
          <div className="glance-next-copy"><h3>{nextBooking.service || nextPackage?.name || 'جلسة تصوير'}</h3><p className="glance-session-time"><Clock3 />{formatTime12(nextBooking.start_time)} – {formatTime12(nextBooking.end_time)}</p><p>{formatDurationMinutes(calculateDurationMinutes(nextBooking.start_time, nextBooking.end_time))} · {resourceLabel}</p>{nextPackage && <p className="glance-next-package">{nextPackage.name}</p>}</div>
        </article>{activeSession && <ClientAppointmentLiveStatus session={activeSession} serverOffset={sessionServerOffset}/>}<footer className="glance-next-footer"><span><CalendarDays />{formatBookingDate(nextBooking.date)}</span><button className="glance-link" type="button" onClick={() => viewBooking(nextBooking)}>تفاصيل الموعد<ArrowLeft /></button></footer></> : <div className="glance-empty"><CalendarDays /><h3>لا يوجد موعد قادم</h3><p>اختر باقة جديدة أو احجز من رصيد باقتك الحالية.</p><button className="glance-link" type="button" onClick={() => onNavigate('book-studio')}>احجز موعد تصوير<ArrowLeft /></button></div>}
      </section>
      <section className="glance-card glance-balance" aria-label="الرصيد المتاح">
        <h2><Clock3 />{selectedPackage && !activeBalance ? 'رصيد الباقة غير متاح للحجز' : selectedPackage?.billing_unit === 'hour' ? 'ساعاتك المتاحة للحجز' : 'رصيدك المتاح للحجز'}</h2>
        <strong className="glance-balance-number">{selectedPackage ? quantityLabel(selectedPackage, quantity.available) : 'لا توجد باقة'}</strong>
        <p>{selectedPackage ? selectedPackage.name : 'ابدأ بباقة تناسب احتياجك'}</p>
        {selectedPackage && <small>{effectivePackageStatus(selectedPackage) !== 'active' ? `الباقة ${formatPackageStatus(effectivePackageStatus(selectedPackage))}` : selectedPackage.expires_at ? `صالحة حتى ${safeClientDate(selectedPackage.expires_at)}` : 'تبدأ الصلاحية عند أول حجز مؤكد'}</small>}
        {canBook ? <button type="button" className="glance-secondary" onClick={() => onBookPackage(selectedPackage.id)}>احجز من رصيد الباقة<ArrowLeft /></button> : <button type="button" className="glance-secondary" onClick={() => onNavigate('book-studio')}>{selectedPackage ? 'احجز باقة جديدة' : 'استعرض باقات التصوير'}<ArrowLeft /></button>}
      </section>
    </div>
    {selectedPackage && <section className="glance-card glance-package-band" aria-labelledby="glance-package-title">
      <header className="glance-section-head"><div className="glance-package-heading"><span className="glance-package-icon"><Package /></span><div><h2 id="glance-package-title">{selectedPackage.name}</h2><p>{quantityLabel(selectedPackage, quantity.purchased)} إجمالي الباقة · {formatPackageStatus(effectivePackageStatus(selectedPackage))}{selectedPackage.expires_at && effectivePackageStatus(selectedPackage) === 'active' ? ` · ${remainingCalendarDays(selectedPackage.expires_at)} يوم متبقي` : ''}</p></div></div><button className="glance-link" type="button" onClick={() => onNavigate('packages')}>تفاصيل الباقة<ArrowLeft /></button></header>
      {financialPackages.length > 1 && <label className="glance-package-select">عرض رصيد باقة أخرى<select aria-label="الباقة المعروضة" value={String(selectedPackage.id)} onChange={event => setSelectedPackageId(event.target.value)}>{financialPackages.map(pkg => <option key={pkg.id} value={String(pkg.id)}>{pkg.name} — {formatPackageStatus(effectivePackageStatus(pkg))} · #{pkg.id}</option>)}</select></label>}
      <div className="glance-usage-bar" role="img" aria-label={`المستخدم ${quantityLabel(selectedPackage, quantity.consumed)}، محجوز ${quantityLabel(selectedPackage, quantity.held)}، متاح ${quantityLabel(selectedPackage, quantity.available)}`}><span style={{ width: `${consumedPercent}%` }}/><span style={{ width: `${heldPercent}%` }}/><span style={{ width: `${availablePercent}%` }}/></div>
      <dl className="glance-usage-labels"><div><dt><i/>{selectedPackage.billing_unit === 'hour' ? 'تم تصويره' : 'المستخدم'}</dt><dd>{quantityLabel(selectedPackage, quantity.consumed)}</dd></div><div><dt><i/>محجوز لمواعيد</dt><dd>{quantityLabel(selectedPackage, quantity.held)}</dd></div><div><dt><i/>{activeBalance ? 'متاح للحجز' : 'رصيد غير متاح'}</dt><dd>{quantityLabel(selectedPackage, quantity.available)}</dd></div></dl>
    </section>}
    <ClientPaymentDueAlarm packages={activePackages} onNavigate={onNavigate}/>
    <div className="glance-lower-grid">
      <section className="glance-agenda" aria-labelledby="glance-upcoming-title"><header className="glance-section-head"><h2 id="glance-upcoming-title">مواعيدك القادمة</h2><button type="button" className="glance-link" onClick={() => onNavigate('schedule')}>عرض الكل<ArrowLeft /></button></header>
        <div className="glance-card glance-agenda-list">{upcomingBookings.length ? upcomingBookings.slice(0, 3).map(booking => { const status = STATUS_META[booking.status] || { label: booking.status, tone: 'neutral' }; return <article className="glance-agenda-row" key={booking.id}><div className="glance-mini-date"><strong>{format(new Date(`${booking.date}T12:00`), 'd')}</strong><small>{format(new Date(`${booking.date}T12:00`), 'MMM', { locale: ar })}</small></div><div><h3>{booking.service || 'جلسة تصوير'}</h3><p>{formatTime12(booking.start_time)} – {formatTime12(booking.end_time)}</p><span className={`client-status client-status--${status.tone}`}>{status.label}</span></div><button type="button" className="glance-icon-button" aria-label={`تفاصيل ${booking.service || 'جلسة تصوير'} يوم ${formatBookingDate(booking.date)}`} onClick={() => viewBooking(booking)}><ArrowLeft /></button></article>; }) : <div className="glance-empty glance-empty--small"><CalendarDays/><p>لا توجد مواعيد قادمة حتى الآن.</p></div>}</div>
      </section>
      <section className="glance-card glance-finance" aria-labelledby="glance-finance-title"><h2 id="glance-finance-title">المتبقي من المدفوعات</h2><strong className="glance-money">{formatEGP(piastresToMoney(finance.remainingPiastres))}</strong><p>إجمالي الباقات والفواتير في حسابك</p>{dueCount > 0 ? <span className="glance-finance-due">توجد مبالغ مستحقة الآن؛ راجع التفاصيل.</span> : finance.remainingPiastres === 0 && <span className="glance-finance-paid"><CheckCircle2 />لا توجد مبالغ متبقية</span>}<div className="glance-finance-summary"><span>تم سداد</span><strong>{formatEGP(piastresToMoney(finance.paidPiastres))}</strong></div><button type="button" className="glance-link" onClick={() => onNavigate('finance')}>المدفوعات وإثبات التحويل<ArrowLeft /></button></section>
    </div>
    <ClientDashboardDeliveries key={client?.id} onNavigate={onNavigate}/>
    <ClientActiveServices projects={projects}/>
    <footer className="glance-page-footer"><span>مساحتك الإبداعية، كل شيء في مكان واحد.</span><span>Multi Task Agency</span></footer>
  </section>;
}
