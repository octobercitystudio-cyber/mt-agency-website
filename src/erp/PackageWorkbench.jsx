import { useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeftRight, CalendarCheck2, CalendarDays, CheckCircle2, ChevronLeft, CircleDollarSign, Eye, History, Info, MessageCircle, MoreVertical, PackageCheck, PackagePlus, PlayCircle, RefreshCw, Users } from 'lucide-react';
import { calculateDurationMinutes, centsToMoney, formatBookingDate, formatBookingStatus, formatDurationMinutes, formatEGP, formatPackageQuantity, formatPackageStatus, formatTime12, packageFinancialSummary, packageQuantitySummary, remainingCalendarDays } from '../lib/businessFormat';
import { cairoAppointmentNowKey } from '../lib/packageSaleAppointments';
import { packageContinuityTag } from './packageContinuity';
import { clientPackageWorkspaceSummary, packageWorkspaceUpcomingBookings, resolvePackageWorkspaceSelection } from './packageWorkspace';
import './PackageWorkbench.css';

const money = cents => formatEGP(centsToMoney(cents));
const initials = name => String(name || 'عميل').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join(' ');

export default function PackageWorkbench({ groups, packages, bookings, todayKey, filters, loading, canAdd, onAdd, onToggleHistory, packageViewProps }) {
  const [selection, setSelection] = useState({ clientId: null, packageId: null });
  const detailHeadingRef = useRef(null);
  const { group, pkg } = resolvePackageWorkspaceSelection(groups, selection.clientId, selection.packageId);
  const summaries = useMemo(() => new Map(groups.map(item => [String(item.clientId), clientPackageWorkspaceSummary(packages, item.clientId, todayKey)])), [groups, packages, todayKey]);
  const summary = group ? summaries.get(String(group.clientId)) : null;
  const upcoming = pkg ? packageWorkspaceUpcomingBookings(bookings, pkg, cairoAppointmentNowKey()) : [];

  // Store the safe fallback as well, so a removed or filtered package cannot silently reappear selected.
  if (String(selection.clientId ?? '') !== String(group?.clientId ?? '') || String(selection.packageId ?? '') !== String(pkg?.id ?? '')) {
    setSelection({ clientId: group?.clientId ?? null, packageId: pkg?.id ?? null });
  }

  const selectClient = item => {
    const next = resolvePackageWorkspaceSelection(groups, item.clientId, null);
    setSelection({ clientId: next.group?.clientId ?? null, packageId: next.pkg?.id ?? null });
    if (window.matchMedia('(max-width: 1100px)').matches) {
      window.requestAnimationFrame(() => {
        detailHeadingRef.current?.focus({ preventScroll: true });
        detailHeadingRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      });
    }
  };
  const selectPackage = packageId => setSelection({ clientId: group.clientId, packageId });
  const movePackageTab = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowLeft') nextIndex = (index + 1) % group.packages.length;
    if (event.key === 'ArrowRight') nextIndex = (index - 1 + group.packages.length) % group.packages.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = group.packages.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const buttons = event.currentTarget.parentElement.querySelectorAll('[role="tab"]');
    selectPackage(group.packages[nextIndex].id);
    buttons[nextIndex]?.focus();
  };

  return <section className="package-workbench" aria-label="قائمة العملاء وتفاصيل الباقات" aria-busy={loading}>
    <aside className="pw-clients" aria-label="اختيار العميل">
      <header className="pw-clients-header"><div><h2><Users aria-hidden="true"/> العملاء وباقاتهم</h2><span>{groups.length.toLocaleString('ar-EG')} عميل</span></div>{filters}</header>
      <div className="pw-client-list">
        {groups.map(item => {
          const itemSummary = summaries.get(String(item.clientId));
          const selected = String(group?.clientId) === String(item.clientId);
          return <button key={item.clientId} type="button" className={`pw-client${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => selectClient(item)} aria-controls="sold-client-workspace">
            <span className="pw-client-top"><span className="pw-avatar" aria-hidden="true">{initials(item.client?.name)}</span><span className="pw-client-identity"><strong>{item.client?.name || `عميل #${item.clientId}`}</strong><small>{itemSummary.totalCount.toLocaleString('ar-EG')} باقة · {itemSummary.activeCount.toLocaleString('ar-EG')} نشطة</small></span><ChevronLeft className="pw-client-arrow" aria-hidden="true"/></span>
            <span className="pw-client-bottom"><span className={`pw-client-due${itemSummary.activeOutstandingCents ? ' has-due' : ''}`}>{itemSummary.activeOutstandingCents ? money(itemSummary.activeOutstandingCents) : 'لا مستحقات نشطة'}</span><span>{itemSummary.activeOutstandingCents ? 'على الباقات النشطة' : 'الباقات النشطة فقط'}</span></span>
          </button>;
        })}
        {!groups.length && <p className="pw-list-empty">{loading ? 'جارٍ تحميل العملاء…' : 'لا يوجد عميل مطابق للفلاتر.'}</p>}
      </div>
      <p className="pw-client-hint"><Info aria-hidden="true"/> اختر العميل لعرض باقاته ومواعيده وحساباته.</p>
    </aside>
    <section className="pw-detail" id="sold-client-workspace" aria-label="تفاصيل العميل المختار">
      {group && pkg ? <>
        <header className="pw-detail-header"><div><span className="pw-eyebrow">ملف العميل</span><h2 ref={detailHeadingRef} tabIndex={-1}>{group.client?.name || `عميل #${group.clientId}`}</h2><div className="pw-client-meta">{group.client?.phone1 && <bdi dir="ltr">{group.client.phone1}</bdi>}<span>{summary.totalCount.toLocaleString('ar-EG')} باقة في الملف</span></div></div><div className="pw-client-finance"><span>المستحق على الباقات النشطة</span><strong>{money(summary.activeOutstandingCents)}</strong><small>{summary.activeCount.toLocaleString('ar-EG')} باقة نشطة</small></div></header>
        <div className="pw-client-tools">{canAdd && <button type="button" onClick={event => onAdd(event, group.clientId)}><PackagePlus aria-hidden="true"/> باقة جديدة لنفس العميل</button>}{group.relatedCount > 0 && <button type="button" aria-expanded={group.expanded} onClick={() => onToggleHistory(group.clientId)}><History aria-hidden="true"/>{group.expanded ? 'إخفاء باقي السجل' : `عرض باقي الباقات (${group.relatedCount.toLocaleString('ar-EG')})`}</button>}{loading && <span className="pw-updating" role="status"><RefreshCw className="packages-spin" aria-hidden="true"/> جارٍ التحديث</span>}</div>
        <nav className="pw-package-tabs" role="tablist" aria-label="باقات العميل" aria-orientation="horizontal">{group.packages.map((item, index) => {
          const selected = String(item.id) === String(pkg.id);
          const tag = packageContinuityTag(item, group, todayKey);
          return <button type="button" key={item.id} id={`sold-package-tab-${item.id}`} role="tab" aria-selected={selected} aria-controls="sold-package-panel" tabIndex={selected ? 0 : -1} className={selected ? 'is-selected' : ''} onClick={() => selectPackage(item.id)} onKeyDown={event => movePackageTab(event, index)}><span><strong>{item.name || 'باقة تصوير'}</strong><bdi>#{item.id}</bdi></span><small className={`pw-continuity pw-continuity--${tag.tone}`}>{tag.label}</small></button>;
        })}</nav>
        {summary.totalCount > 1 && <p className="pw-priority-note"><ArrowLeftRight aria-hidden="true"/><span>أولوية الحجز للباقة الصالحة الأقرب انتهاءً وبها رصيد، ثم الباقة التالية. كل موعد ودفعة على باقته.</span></p>}
        <div id="sold-package-panel" role="tabpanel" aria-labelledby={`sold-package-tab-${pkg.id}`} tabIndex={0}>
          <WorkspacePackage upcoming={upcoming} todayKey={todayKey} {...packageViewProps(pkg)}/>
        </div>
      </> : <div className="pw-empty" role="status">{loading ? <RefreshCw className="packages-spin" aria-hidden="true"/> : <Archive aria-hidden="true"/>}<h2>{loading ? 'جارٍ تحميل الباقات' : 'لا توجد باقات مطابقة'}</h2><p>{loading ? 'نجهّز ملفات العملاء وأرصدة الباقات.' : 'غيّر عوامل البحث أو أضف باقة جديدة لعميل.'}</p>{!loading && canAdd && <button type="button" onClick={onAdd}><PackagePlus aria-hidden="true"/> إضافة باقة لعميل</button>}</div>}
    </section>
  </section>;
}

function WorkspacePackage({ pkg, person, upcoming, todayKey, status, canAdjust, canViewDetails, canBook, canPay, canStart, running, onBook, onPay, onStart, onDetails, onShare, onShareAppointments, onOwner }) {
  const quantity = packageQuantitySummary(pkg);
  const financial = packageFinancialSummary(pkg);
  const total = Math.max(quantity.purchased, quantity.consumed + quantity.held + quantity.available, 1);
  const days = remainingCalendarDays(pkg.expires_at, todayKey);
  const sessionLabel = `${pkg.name} للعميل ${person?.name || 'عميل'}`;
  return <>
    <div className="pw-package-heading"><div><h3>رصيد الباقة <bdi>#{pkg.id}</bdi></h3><span>إجمالي الباقة {formatPackageQuantity(quantity.purchased, pkg.billing_unit)}</span></div><span className={`pw-status pw-status--${status}`}>{formatPackageStatus(status)}</span></div>
    <dl className="pw-balances"><div><dt>تم استخدامه</dt><dd>{formatPackageQuantity(quantity.consumed, pkg.billing_unit)}</dd></div><div><dt>محجوز لمواعيد قادمة</dt><dd>{formatPackageQuantity(quantity.held, pkg.billing_unit)}</dd></div><div className="pw-available"><dt>متاح لحجز جديد</dt><dd>{formatPackageQuantity(quantity.available, pkg.billing_unit)}</dd></div></dl>
    <div className="pw-balance-bar" role="img" aria-label={`مستخدم ${formatPackageQuantity(quantity.consumed, pkg.billing_unit)}، محجوز ${formatPackageQuantity(quantity.held, pkg.billing_unit)}، متاح ${formatPackageQuantity(quantity.available, pkg.billing_unit)}`}><span className="pw-used" style={{ width: `${quantity.consumed / total * 100}%` }}/><span className="pw-held" style={{ width: `${quantity.held / total * 100}%` }}/><span className="pw-free" style={{ width: `${quantity.available / total * 100}%` }}/></div>
    <div className="pw-balance-note"><span>المتبقي غير المستخدم: {formatPackageQuantity(quantity.remaining, pkg.billing_unit)}</span><span>{pkg.billing_unit === 'reel' ? 'الرصيد محسوب بالريل' : 'الرصيد محسوب بالساعات والدقائق'}</span></div>
    <dl className="pw-validity"><div><dt>بداية الصلاحية</dt><dd>{pkg.starts_at ? <bdi>{formatBookingDate(pkg.starts_at)}</bdi> : 'عند أول حجز تصوير'}</dd></div><div><dt>نهاية الصلاحية</dt><dd>{pkg.expires_at ? <bdi>{formatBookingDate(pkg.expires_at)}</bdi> : 'تُحسب من أول حجز'}</dd></div><div><dt>الأيام المتبقية</dt><dd>{pkg.expires_at ? `${Math.max(0, days).toLocaleString('ar-EG')} يوم` : 'لم تبدأ بعد'}</dd></div></dl>
    <section className="pw-schedule" aria-label="مواعيد الباقة المختارة"><header><h3><CalendarDays aria-hidden="true"/> المواعيد القادمة</h3><span>{upcoming.length.toLocaleString('ar-EG')} موعد · الباقة <bdi>#{pkg.id}</bdi></span></header>{upcoming.length ? <div className="pw-schedule-table"><table><thead><tr><th>اليوم والتاريخ</th><th>من – إلى</th><th>مدة التصوير</th><th>الحالة</th><th>مسجل على</th></tr></thead><tbody>{upcoming.map(booking => <tr key={booking.id}><td className="pw-booking-date"><span className="pw-timeline-dot" aria-hidden="true"/><bdi>{formatBookingDate(booking.date)}</bdi></td><td className="pw-booking-time"><span><small>من</small> <bdi>{formatTime12(booking.start_time)}</bdi></span><span><small>إلى</small> <bdi>{formatTime12(booking.end_time)}</bdi></span></td><td className="pw-booking-duration">{formatDurationMinutes(Number(booking.duration_minutes) || calculateDurationMinutes(booking.start_time, booking.end_time), { compact: true })}{pkg.billing_unit === 'reel' && <small>{formatPackageQuantity(booking.requested_quantity, 'reel')} من الرصيد</small>}</td><td className="pw-booking-status"><span className={`pw-status pw-status--${booking.status}`}>{formatBookingStatus(booking.status)}</span></td><td className="pw-booking-package"><span>الباقة <bdi>#{booking.client_package_id}</bdi></span></td></tr>)}</tbody></table></div> : <div className="pw-schedule-empty"><CalendarCheck2 aria-hidden="true"/><div><strong>لا توجد مواعيد قادمة لهذه الباقة</strong><p>{canBook ? 'يمكنك إضافة موعد جديد حسب الصلاحية والرصيد المتاح.' : 'يمكنك مراجعة المواعيد السابقة من تفاصيل الباقة.'}</p></div></div>}</section>
    <section className="pw-finance" aria-label="حساب الباقة المختارة"><header><h3>حساب الباقة <bdi>#{pkg.id}</bdi></h3><span className={`pw-payment-status${financial.outstandingCents > 0 ? ' has-due' : ''}`}>{financial.outstandingCents > 0 ? 'متبقي للتحصيل' : 'لا يوجد مبلغ مستحق'}</span></header><dl><div><dt>إجمالي سعر الباقة</dt><dd>{money(financial.totalCents)}</dd></div><div><dt>المدفوع</dt><dd>{money(financial.paidCents)}</dd></div><div className={financial.outstandingCents > 0 ? 'pw-due-amount' : ''}><dt>المتبقي للدفع</dt><dd>{money(financial.outstandingCents)}</dd></div>{financial.creditCents > 0 && <div><dt>رصيد دائن للعميل</dt><dd>{money(financial.creditCents)}</dd></div>}</dl>{financial.overageCents > 0 && <p>يشمل المتبقي قيمة تجاوز قدرها {money(financial.overageCents)}.</p>}</section>
    <footer className="pw-actions"><div className="pw-main-actions">{canBook && <button type="button" className="pw-primary package-booking-button" onClick={onBook} aria-label={`حجز موعد من ${sessionLabel}`}><CalendarCheck2 aria-hidden="true"/> حجز موعد</button>}{canPay && <button type="button" className="package-payment-button" onClick={onPay} aria-label={`تسجيل دفعة على ${sessionLabel}`}><CircleDollarSign aria-hidden="true"/> تسجيل دفعة</button>}{running ? <span className="pw-session-running" role="status"><CheckCircle2 aria-hidden="true"/> التصوير جارٍ</span> : canStart && <button type="button" className="pw-start package-session-start" onClick={onStart} aria-label={`ابدأ التصوير وحساب ساعات ${sessionLabel}`}><PlayCircle aria-hidden="true"/> ابدأ التصوير</button>}{canViewDetails && <button type="button" className="pw-details package-details-button" onClick={onDetails}><Eye aria-hidden="true"/> عرض التفاصيل</button>}</div><div className="pw-secondary-actions">{canViewDetails && <><button type="button" className="package-whatsapp-button" onClick={onShare} aria-label={`إرسال تفاصيل ${sessionLabel}`}><MessageCircle aria-hidden="true"/> إرسال التفاصيل</button><button type="button" className="package-appointments-whatsapp-button" onClick={onShareAppointments} aria-label={`إرسال مواعيد التصوير الخاصة بـ ${sessionLabel}`}><CalendarDays aria-hidden="true"/> إرسال المواعيد</button></>}{canAdjust && <button type="button" className="package-owner-button" onClick={onOwner}><MoreVertical aria-hidden="true"/> تحكم المالك</button>}</div></footer>
    <p className="pw-package-footer"><PackageCheck aria-hidden="true"/> المواعيد والأرصدة والمدفوعات المعروضة تخص هذه الباقة فقط.</p>
  </>;
}
