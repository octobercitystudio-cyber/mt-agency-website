import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, BadgeDollarSign, CalendarDays, Check, Clock3,
  Eye, FileCheck2, FolderKanban, PackageCheck, PlayCircle, Plus, RefreshCw, TimerOff, UserPlus, UsersRound, X,
} from 'lucide-react';
import { dataClient, dataProvider } from '../dataClient';
import { useData } from '../store/DataContext';
import { attendanceApi } from '../lib/attendanceApi';
import { formatBookingDate, formatBookingStatus, formatEGP, formatPackageStatus, formatTime12, moneyToCents, timeToMinutes } from '../lib/businessFormat';
import ERPPageHero from './ERPPageHero';
import ERPDashboardTasks from './ERPDashboardTasks';
import ERPAddBookingModal from './ERPAddBookingModal';
import ERPClientModal from './ERPClientModal';
import { ERPCreatePromotionDrawer } from './ERPPromotions';
import useChangeSync from '../hooks/useChangeSync';
import ERPStartSessionDialog from './ERPStartSessionDialog';
import { canRoleStartStudioSession } from './studioSessionStart';
import { eligibilityMap, studioBookingEligible } from './studioSessionEligibility';
import { requestDashboardModule } from '../lib/dashboardLoad';
import { isClientBookingVisible as isDashboardBookingVisible } from '../lib/clientBookingVisibility';
import useModalDialog from '../hooks/useModalDialog';
import './ERPDashboard.css';
import './ERPDashboardFixes.css';

const cairoDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const money = (value) => formatEGP(value);
const roleLabels = { owner: 'مالك', admin: 'مدير', operations: 'تشغيل', finance: 'مالية', staff: 'موظف' };
const normalizeStatus = (status = '') => ({ 'قيد الانتظار': 'pending', 'مؤكد': 'confirmed', 'ملغي': 'cancelled', 'ملغى': 'cancelled', 'مرفوض': 'rejected' }[status] || status);

const ledgerDate = value => {
  if (!value) return 'غير محدد';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'غير محدد' : new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

const ReceivablesDialog = ({ open, onClose, returnFocusRef, view, onRetry }) => {
  const dialogRef = useModalDialog(open, onClose, { returnFocusRef, isolateBackground: true });
  const groups = useMemo(() => {
    const byClient = new Map();
    (view.data?.items || []).forEach(item => {
      const key = Number(item.client_id);
      if (!byClient.has(key)) byClient.set(key, { clientId: key, clientName: item.client_name, items: [], totalCents: 0 });
      const group = byClient.get(key);
      group.items.push(item);
      group.totalCents += moneyToCents(item.outstanding_amount);
    });
    return [...byClient.values()].sort((left, right) => right.totalCents - left.totalCents || left.clientId - right.clientId);
  }, [view.data]);

  if (!open) return null;
  const reconciliation = view.data?.reconciliation || {};
  const closeOnBackdrop = event => { if (event.target === event.currentTarget) onClose(); };

  return (
    <div className="receivables-backdrop" onMouseDown={closeOnBackdrop}>
      <section ref={dialogRef} className="receivables-dialog" role="dialog" aria-modal="true" aria-labelledby="receivables-title" aria-describedby="receivables-note" tabIndex={-1}>
        <header className="receivables-dialog__header">
          <div>
            <span className="ops-kicker">كشف مراجع بالقرش</span>
            <h2 id="receivables-title">تفصيل المستحقات غير المحصلة</h2>
            <p id="receivables-note">كل بند هو رصيد باقة مباعة لم يُحصّل بالكامل.</p>
          </div>
          <button type="button" className="receivables-dialog__close" onClick={onClose} aria-label="إغلاق تفصيل المستحقات" data-dialog-initial><X aria-hidden="true" /></button>
        </header>

        {view.loading ? (
          <div className="receivables-state" role="status" aria-live="polite">
            <RefreshCw className="receivables-state__spinner" aria-hidden="true" />
            <strong>جارٍ تجميع أرصدة الباقات…</strong>
            <span>نراجع القيمة والمدفوع والزيادات لكل باقة.</span>
          </div>
        ) : view.error ? (
          <div className="receivables-state receivables-state--error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <strong>تعذر تحميل تفاصيل المبلغ</strong>
            <span>{view.error}</span>
            <button type="button" onClick={onRetry}>إعادة المحاولة</button>
          </div>
        ) : !view.data?.items?.length ? (
          <div className="receivables-state">
            <Check aria-hidden="true" />
            <strong>لا توجد مستحقات غير محصلة</strong>
            <span>جميع أرصدة الباقات المباعة مسددة حاليًا.</span>
            <Link to="/erp/packages" onClick={onClose}>فتح الباقات المباعة</Link>
          </div>
        ) : (
          <div className="receivables-dialog__body">
            <div className="receivables-headline">
              <div><span>إجمالي المستحق الحالي</span><strong>{money(view.data.amount)}</strong></div>
              <div><span>الباقات التي عليها رصيد</span><strong>{view.data.item_count} {Number(view.data.item_count) === 1 ? 'باقة' : 'باقات'}</strong></div>
            </div>

            <div className="receivables-equation" aria-label="مطابقة إجمالي المستحقات">
              <div><span>قيمة الباقات</span><strong>{money(reconciliation.total_price)}</strong></div>
              <b aria-hidden="true">+</b>
              <div><span>الزيادات</span><strong>{money(reconciliation.overage_amount)}</strong></div>
              <b aria-hidden="true">−</b>
              <div className="receivables-equation__paid"><span>المدفوع</span><strong>{money(reconciliation.paid_amount)}</strong></div>
              <b aria-hidden="true">=</b>
              <div className="receivables-equation__due"><span>المستحق</span><strong>{money(reconciliation.outstanding_amount)}</strong></div>
            </div>
            <p className="receivables-formula-note">الحساب من الباقات الظاهرة فقط: قيمة الباقة + الزيادات − المدفوع. لا تُضاف الفواتير أو أرصدة العملاء القديمة.</p>

            <div className="receivables-ledger">
              {groups.map(group => (
                <section className="receivables-client" key={group.clientId} aria-labelledby={`receivables-client-${group.clientId}`}>
                  <header className="receivables-client__header">
                    <div><span>العميل</span><h3 id={`receivables-client-${group.clientId}`}>{group.clientName}</h3></div>
                    <div><span>{group.items.length} {group.items.length === 1 ? 'باقة' : 'باقات'}</span><strong>{money(group.totalCents / 100)}</strong></div>
                  </header>
                  <div className="receivables-ledger__table" role="table" aria-label={`باقات ${group.clientName}`}>
                    <div className="receivables-ledger__columns" role="row">
                      <span role="columnheader">الباقة والحالة</span><span role="columnheader">القيمة</span><span role="columnheader">الزيادات</span><span role="columnheader">المدفوع</span><span role="columnheader">المستحق</span>
                    </div>
                    <div role="rowgroup">
                      {group.items.map(item => (
                        <div className="receivables-row" role="row" key={item.package_id}>
                          <div className="receivables-row__identity" role="cell">
                            <strong>{item.package_name}</strong>
                            <span><em data-status={item.status}>{formatPackageStatus(item.status)}</em> · رقم <bdi>#{item.package_id}</bdi></span>
                            <small>من {ledgerDate(item.starts_at)} إلى {ledgerDate(item.expires_at)}</small>
                          </div>
                          <div role="cell" data-label="القيمة"><bdi>{money(item.total_price)}</bdi></div>
                          <div role="cell" data-label="الزيادات" className="receivables-row__overage"><bdi>{money(item.overage_amount)}</bdi></div>
                          <div role="cell" data-label="المدفوع" className="receivables-row__paid"><bdi>{money(item.paid_amount)}</bdi></div>
                          <div role="cell" data-label="المستحق" className="receivables-row__due"><bdi>{money(item.outstanding_amount)}</bdi></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        <footer className="receivables-dialog__footer">
          <span>هذا الكشف للقراءة والمراجعة فقط.</span>
          <Link to="/erp/packages" onClick={onClose}>إدارة الباقات <ArrowLeft aria-hidden="true" /></Link>
        </footer>
      </section>
    </div>
  );
};

const ERPDashboard = () => {
  const { currentUser, isAuthReady } = useData();
  const navigate = useNavigate();
  const [clock, setClock] = useState(new Date());
  const [state, setState] = useState({ loading: true, error: '', bookings: [], actions: [], tasks: [], health: {}, packageMap: {}, sessionEligibility: {} });
  const [attendance, setAttendance] = useState({ loading: true, error: '', data: null });
  const [createAction, setCreateAction] = useState('');
  const [quickActionNotice, setQuickActionNotice] = useState('');
  const [sessionStart, setSessionStart] = useState({ open: false, booking: null });
  const [receivablesDialog, setReceivablesDialog] = useState({ open: false, loading: false, error: '', data: null });
  const sessionTriggerRef = useRef(null);
  const bookingTriggerRef = useRef(null);
  const receivablesTriggerRef = useRef(null);
  const receivablesLoadRef = useRef(0);
  const loadSequenceRef = useRef(0);
  const openBookingCreate = event => { bookingTriggerRef.current = event?.currentTarget || null; setCreateAction('booking'); };

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!isAuthReady || !currentUser?.role) return;
    const loadSequence = ++loadSequenceRef.current;
    setState((old) => ({ ...old, loading: true, error: '' }));
    const today = cairoDate();
    const role = currentUser?.role;
    const scopedRequest = (roles, request, fallback = []) => roles.includes(role)
      ? request()
      : Promise.resolve({ data: fallback, error: null, skipped: true });
    try {
      const [bookingsResult, pendingBookings, reschedules, proofs, packages, tasks, sessionEligibility, dashboardKpis] = await Promise.all([
        requestDashboardModule(() => dataClient.from('bookings').select('*').eq('date', today).order('start_time', { ascending: true })),
        requestDashboardModule(() => dataClient.from('bookings').select('id,client_name,status,date,start_time').in('status', ['pending', 'cancel_requested', 'late_cancel_requested']).limit(8)),
        requestDashboardModule(() => scopedRequest(['owner', 'admin', 'operations', 'staff'], () => dataClient.from('reschedule_requests').select('id,booking_id,client_id,status,proposed_date,proposed_start_time').eq('status', 'pending').limit(8))),
        requestDashboardModule(() => scopedRequest(['owner', 'admin', 'finance'], () => dataClient.from('payment_proofs').select('id,client_id,amount,status,created_at').eq('status', 'pending').limit(8))),
        requestDashboardModule(() => scopedRequest(['owner', 'admin', 'operations'], () => dataClient.from('client_packages').select('id,name').eq('status', 'active'))),
        requestDashboardModule(() => dataClient.from('reminders').select('id,title,due_date,type,status,amount').eq('status', 'pending').order('due_date', { ascending: true }).limit(6)),
        requestDashboardModule(() => scopedRequest(['owner', 'admin', 'operations'], () => dataClient.request(`/studio-session-eligibility?date=${today}`), { items: [] })),
        requestDashboardModule(
          () => scopedRequest(['owner', 'admin', 'operations', 'finance'], () => dataClient.request('/dashboard/kpis'), {}),
          { shouldRetryResult: (result) => Boolean(result?.error || result?.data?.partial_errors?.length) },
        ),
      ]);
      if (loadSequence !== loadSequenceRef.current) return;
      const partialKpiFailure = (dashboardKpis.data?.partial_errors || []).length > 0;
      const failedModules = [bookingsResult, pendingBookings, reschedules, proofs, packages, tasks, sessionEligibility, dashboardKpis].filter((result) => result.error);
      if (failedModules.length || partialKpiFailure) console.error('Dashboard data modules unavailable:', [...failedModules.map((result) => result.error), ...(dashboardKpis.data?.partial_errors || [])]);
      const actions = [
        ...(pendingBookings.data || []).map((item) => ({ ...item, kind: 'booking', title: `${formatBookingStatus(normalizeStatus(item.status))} — ${item.client_name}`, meta: `${formatBookingDate(item.date)} · ${formatTime12(item.start_time, '')}`, to: '/erp/requests' })),
        ...(reschedules.data || []).map((item) => ({ ...item, kind: 'reschedule', title: 'طلب تغيير موعد', meta: `${formatBookingDate(item.proposed_date)} · ${formatTime12(item.proposed_start_time, '')}`, to: '/erp/requests' })),
        ...(proofs.data || []).map((item) => ({ ...item, kind: 'payment', title: 'إثبات تحويل يحتاج مراجعة', meta: money(item.amount), to: '/erp/requests' })),
      ].slice(0, 8);
      const kpis = dashboardKpis.data || {};
      const packageMap = Object.fromEntries((packages.data || []).map(pkg => [Number(pkg.id), pkg]));
      setState({
        loading: false,
        error: failedModules.length || partialKpiFailure ? 'تعذر تحميل بعض بيانات التشغيل الآن. يمكنك متابعة الأقسام المتاحة أو إعادة المحاولة.' : '',
        bookings: (bookingsResult.data || []).filter((booking) => isDashboardBookingVisible({ status: normalizeStatus(booking.status) })), actions,
        tasks: tasks.data || [],
        tasksError: tasks.error ? 'تحقق من الاتصال ثم أعد المحاولة.' : '',
        packageMap,
        sessionEligibility: eligibilityMap(sessionEligibility.data),
        health: {
          kpiFailed: Boolean(dashboardKpis.error) || partialKpiFailure,
          receivablesAvailable: kpis.receivables?.available === true,
          cashAvailable: kpis.cash_movement?.available === true,
          outstanding: Number(kpis.receivables?.amount || 0),
          cashIn: Number(kpis.cash_movement?.cash_in || 0),
          cashOut: Number(kpis.cash_movement?.cash_out || 0),
          packagesAvailable: kpis.active_packages?.available === true,
          activePackages: Number(kpis.active_packages?.count || 0),
          expiringSoon: Number(kpis.active_packages?.expiring_within_14_days || 0),
          servicesAvailable: kpis.active_services?.available === true,
          activeProjects: Number(kpis.active_services?.active_projects || 0),
          pausedProjects: Number(kpis.active_services?.paused_projects || 0),
          activeContent: Number(kpis.active_services?.active_content_items || 0),
        },
      });
    } catch (error) {
      if (loadSequence !== loadSequenceRef.current) return;
      console.error('Dashboard load failed:', error);
      setState((old) => ({ ...old, loading: false, tasksError: 'تحقق من الاتصال ثم أعد المحاولة.', error: 'تعذر تحميل بيانات التشغيل الآن. تحقق من الاتصال ثم أعد المحاولة.' }));
    }
  }, [currentUser?.role, isAuthReady]);

  const loadAttendance = useCallback(async () => {
    setAttendance({ loading: true, error: '', data: null });
    if (currentUser?.is_local_preview || dataProvider !== 'hostinger') {
      setAttendance({
        loading: false,
        error: '',
        data: {
          preview: true,
          self: { tracked: false },
          team: [
            { user_id: 3, full_name: 'كريم حسن', role: 'operations', track_attendance: 1, record_id: 1, check_in_at: `${cairoDate()} 12:08:00`, late_minutes: 0 },
            { user_id: 4, full_name: 'ليلى عمر', role: 'staff', track_attendance: 1, record_id: 2, check_in_at: `${cairoDate()} 12:27:00`, late_minutes: 12 },
          ],
        },
      });
      return;
    }
    try { setAttendance({ loading: false, error: '', data: await attendanceApi.today() }); }
    catch (error) { setAttendance({ loading: false, error: error.message || 'تعذر تحميل الحضور.', data: null }); }
  }, [currentUser]);

  useEffect(() => {
    if (!isAuthReady || !currentUser?.role) return undefined;
    load();
    loadAttendance();
    return () => { loadSequenceRef.current += 1; };
  }, [currentUser?.role, isAuthReady, load, loadAttendance]);
  useChangeSync(useCallback((topics) => {
    if (topics.some(topic => ['bookings', 'client_packages', 'finance', 'invoices', 'clients', 'projects', 'content_items', 'notifications'].includes(topic))) load();
  }, [load]), !currentUser?.is_local_preview);

  const checkOut = async () => {
    try { await attendanceApi.checkOut(); await loadAttendance(); }
    catch (error) { setAttendance((old) => ({ ...old, error: error.message || 'تعذر تسجيل الانصراف.' })); }
  };

  const timelineBookings = useMemo(() => state.bookings.map((booking) => {
    const start = booking.start_time || '12:00'; const end = booking.end_time || start;
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end, { endOfDay: true });
    const top = Math.max(0, ((startMinutes - 720) / 720) * 100);
    const height = Math.max(7, ((endMinutes - startMinutes) / 720) * 100);
    return { ...booking, normalizedStatus: normalizeStatus(booking.status), start, end, top, height };
  }), [state.bookings]);

  const canStartSessions = canRoleStartStudioSession(currentUser?.role);
  const canStartBooking = booking => canStartSessions && studioBookingEligible(booking, state.sessionEligibility);
  const openSessionStart = (booking, event) => {
    sessionTriggerRef.current = event.currentTarget;
    setSessionStart({ open: true, booking });
  };
  const handleSessionStarted = async booking => {
    setState(current => ({ ...current, bookings: current.bookings.map(item => Number(item.id) === Number(booking.id) ? { ...item, status: 'in_progress' } : item) }));
    setQuickActionNotice(`بدأ تصوير ${booking.client_name} والتايمر يعمل الآن.`);
    await load();
  };

  const loadReceivables = useCallback(async () => {
    const sequence = ++receivablesLoadRef.current;
    setReceivablesDialog(current => ({ ...current, loading: true, error: '', data: null }));
    const result = await requestDashboardModule(() => dataClient.request('/dashboard/receivables'));
    if (sequence !== receivablesLoadRef.current) return;
    if (result.error) {
      setReceivablesDialog(current => ({ ...current, loading: false, error: result.error.message || 'تحقق من الاتصال ثم أعد المحاولة.', data: null }));
      return;
    }
    setReceivablesDialog(current => ({ ...current, loading: false, error: '', data: result.data }));
    setState(current => ({ ...current, health: { ...current.health, outstanding: Number(result.data?.amount || 0) } }));
  }, []);

  const openReceivables = event => {
    receivablesTriggerRef.current = event.currentTarget;
    setReceivablesDialog(current => ({ ...current, open: true }));
    loadReceivables();
  };
  const closeReceivables = () => {
    receivablesLoadRef.current += 1;
    setReceivablesDialog(current => ({ ...current, open: false, loading: false }));
  };

  const currentMarker = useMemo(() => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(clock).map((part) => [part.type, part.value]));
    const minutes = (Number(parts.hour) * 60) + Number(parts.minute);
    return minutes >= 720 && minutes <= 1440 ? ((minutes - 720) / 720) * 100 : null;
  }, [clock]);

  const teamTracked = attendance.data?.team?.filter((member) => Number(member.track_attendance) === 1) || [];
  const teamCounts = teamTracked.reduce((acc, member) => {
    if (!member.record_id) acc.absent += 1;
    else if (Number(member.late_minutes) > 0) acc.late += 1;
    else acc.present += 1;
    return acc;
  }, { present: 0, late: 0, absent: 0 });
  const selfRecord = attendance.data?.self?.record;
  const unavailableKpiCopy = state.health.kpiFailed ? 'تعذر تحميل المؤشر' : 'غير متاح لهذا الدور';
  const cashNet = Number(state.health.cashIn || 0) - Number(state.health.cashOut || 0);
  const activeProjectsUnit = state.health.activeProjects === 1 ? 'مشروع' : 'مشروعات';

  return (
    <main className="ops-dashboard" aria-busy={state.loading}>
      <ERPPageHero
        className="ops-commandbar"
        identityClassName="ops-commandbar__identity"
        eyebrow="مركز عمليات MT Agency"
        title={`أهلًا، ${currentUser?.full_name || 'مستخدم النظام'}`}
        description={<>{roleLabels[currentUser?.role] || currentUser?.role} · {new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long' }).format(clock)} · <bdi>{new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', hour: 'numeric', minute: '2-digit', hour12: true }).format(clock)}</bdi></>}
        actions={<>
          <button type="button" data-variant="primary" className="ops-action ops-action--primary" onClick={openBookingCreate}><Plus size={17} /> حجز جديد</button>
          <button type="button" className="ops-action" onClick={() => setCreateAction('client')}><UserPlus size={17} /> عميل جديد</button>
          {['owner','admin'].includes(currentUser?.role) && <button type="button" className="ops-action" onClick={() => setCreateAction('promotion')}><FileCheck2 size={17} /> عرض حصري</button>}
        </>}
        details={<div className="ops-attendance-chip">
          <div><span>حضورك اليوم</span><strong>{attendance.loading ? 'جارٍ التحقق…' : !attendance.data?.self?.tracked ? 'غير خاضع للتتبع' : selfRecord?.check_out_at ? 'تم الانصراف' : selfRecord ? `دخول ${formatTime12(selfRecord.check_in_at)}` : 'لم يُسجل'}</strong></div>
          {selfRecord && !selfRecord.check_out_at && <button type="button" onClick={checkOut}><TimerOff size={16} /> تسجيل الانصراف</button>}
        </div>}
      />

      <section className="ops-health" aria-label="صحة العمل" aria-busy={state.loading}>
        {!state.loading && state.health.receivablesAvailable ? (
          <button type="button" className="ops-health__cell ops-health__cell--interactive" onClick={openReceivables} aria-label={`عرض تفاصيل المستحقات غير المحصلة بقيمة ${money(state.health.outstanding)}`}>
            <span>مستحقات غير محصلة</span><strong>{money(state.health.outstanding)}</strong><small>المتبقي للدفع من جميع الباقات المباعة</small><em>عرض التفاصيل <ArrowLeft aria-hidden="true" /></em>
          </button>
        ) : <div className="ops-health__cell"><span>مستحقات غير محصلة</span><strong>{state.loading || !state.health.receivablesAvailable ? '—' : money(state.health.outstanding)}</strong><small>{state.loading ? 'جارٍ تحديث المؤشات…' : unavailableKpiCopy}</small></div>}
        <div className="ops-health__cell"><span>الأرباح</span><strong className={cashNet < 0 ? 'negative' : ''}>{state.loading || !state.health.cashAvailable ? '—' : money(cashNet)}</strong><small>{state.loading ? 'جارٍ تحديث المؤشات…' : state.health.cashAvailable ? <>هذا الشهر · إيراد {money(state.health.cashIn)} · مصروف {money(state.health.cashOut)} · دون التحويل الداخلي</> : unavailableKpiCopy}</small></div>
        <div className="ops-health__cell"><span>الباقات الفعالة</span><strong>{state.loading || !state.health.packagesAvailable ? '—' : state.health.activePackages}</strong><small>{state.loading ? 'جارٍ تحديث المؤشات…' : state.health.packagesAvailable ? <><PackageCheck size={14} aria-hidden="true" /> {state.health.expiringSoon} تنتهي خلال 14 يومًا</> : unavailableKpiCopy}</small></div>
        <div className="ops-health__cell"><span>الخدمات النشطة</span><strong>{state.loading || !state.health.servicesAvailable ? '—' : `${state.health.activeProjects} ${activeProjectsUnit}`}</strong><small>{state.loading ? 'جارٍ تحديث المؤشرات…' : state.health.servicesAvailable ? <><FolderKanban size={14} aria-hidden="true" /> {state.health.activeProjects} مشروع · {state.health.activeContent} محتوى{state.health.pausedProjects > 0 ? ` · ${state.health.pausedProjects} متوقف مؤقتًا` : ''}</> : unavailableKpiCopy}</small></div>
      </section>

      {state.error && <div className="ops-state ops-state--error" role="alert"><AlertTriangle size={18} /> {state.error}<button onClick={load}>إعادة المحاولة</button></div>}

      <section className="ops-grid-main">
        <article className="ops-panel ops-runway">
          <div className="ops-panel__heading">
            <div><span className="ops-kicker">المشهد التشغيلي</span><h2>مسار الاستديو اليوم</h2></div>
            <Link to="/erp/bookings">فتح التقويم <ArrowLeft size={16} /></Link>
          </div>
          {state.loading ? <div className="ops-skeleton ops-skeleton--timeline" /> : (
            <div className={`runway ${timelineBookings.length === 0 ? 'runway--empty' : ''}`} aria-label="جدول حجوزات اليوم من الثانية عشرة ظهرًا إلى الثانية عشرة منتصف الليل">
              <div className="runway__hours">{Array.from({ length: 13 }, (_, index) => <span key={index}>{formatTime12(index === 12 ? '24:00' : `${String(index + 12).padStart(2, '0')}:00`)}</span>)}</div>
              <div className="runway__track">
                <span className="runway__resource">الاستديو الرئيسي</span>
                {Array.from({ length: 13 }, (_, index) => <i key={index} style={{ top: `${(index / 12) * 100}%` }} />)}
                {currentMarker !== null && <span className="runway__now" style={{ top: `${currentMarker}%` }}><b>الآن</b></span>}
                {timelineBookings.length === 0 && <button className="runway-empty-slot" type="button" onClick={openBookingCreate}><CalendarDays size={24} /><strong>اليوم متاح بالكامل</strong><small>12:00 م — 12:00 ص</small><span><Plus size={15} /> إضافة أول حجز</span></button>}
                {timelineBookings.map((booking, index) => (
                  <article key={booking.id} className={`runway-booking runway-booking--${booking.normalizedStatus}`} style={{ top: `${booking.top}%`, height: `${booking.height}%`, insetInlineStart: `${(index % 2) * 48}%`, width: timelineBookings.length > 1 ? '47%' : '96%' }}>
                    <span className="runway-booking__time"><bdi>{formatTime12(booking.start)}–{formatTime12(booking.end)}</bdi></span>
                    <div className="runway-booking__identity">
                      <div className="runway-booking__identity-copy"><strong>{booking.client_name}</strong><small>{booking.service || 'تصوير استديو'} · {booking.resource_name || 'الاستديو الرئيسي'}</small></div>
                      {canStartBooking(booking) && <button type="button" className="runway-booking__start" onClick={event => openSessionStart(booking, event)} aria-label={`ابدأ تصوير ${booking.client_name}`}><PlayCircle aria-hidden="true" /> ابدأ التصوير</button>}
                      {booking.normalizedStatus === 'in_progress' && <span className="runway-booking__running" role="status"><i /> التصوير جارٍ</span>}
                    </div>
                    <div className="runway-booking__footer"><em>{formatBookingStatus(booking.normalizedStatus)}</em><span className="runway-booking__controls"><button type="button" className="runway-booking__details" onClick={() => navigate('/erp/bookings')} aria-label={`عرض حجز ${booking.client_name}`}><Eye /></button>{booking.normalizedStatus === 'completed' && <span className="runway-booking__completed"><Check /> تم</span>}</span></div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </article>

        <aside className="ops-panel ops-queue">
          <div className="ops-panel__heading"><div><span className="ops-kicker">يحتاج قرارًا</span><h2>طابور الإجراءات</h2></div><span className="ops-count">{state.actions.length}</span></div>
          {state.loading ? <div className="ops-skeleton ops-skeleton--list" /> : state.actions.length === 0 ? <div className="ops-empty ops-empty--compact"><Check size={26} /><h3>لا توجد قرارات معلقة</h3><p>صندوق الطلبات مراجع بالكامل.</p></div> : (
            <div className="ops-queue__list">{state.actions.map((item) => <Link to={item.to} key={`${item.kind}-${item.id}`}><span className={`ops-queue__icon ops-queue__icon--${item.kind}`}>{item.kind === 'payment' ? <BadgeDollarSign size={17} /> : <Clock3 size={17} />}</span><div><strong>{item.title}</strong><small>{item.meta}</small></div><ArrowLeft size={16} /></Link>)}</div>
          )}
          <Link className="ops-panel__footer" to="/erp/requests">عرض صندوق الطلبات كاملًا</Link>
        </aside>
      </section>

      <section className="ops-grid-lower">
        <article className="ops-panel ops-attendance">
          <div className="ops-panel__heading"><div><span className="ops-kicker">فريق العمل</span><h2>الحضور اليوم</h2></div><Link to="/erp/attendance">السجل الكامل <ArrowLeft size={16} /></Link></div>
          {attendance.error ? <div className="ops-inline-error">{attendance.error}</div> : attendance.loading ? <div className="ops-skeleton ops-skeleton--list" /> : teamTracked.length === 0 ? (
            <div className="ops-empty ops-empty--compact"><UsersRound size={28} /><h3>لا يوجد موظفون خاضعون للحضور</h3><p>المالكان معفيان افتراضيًا. يمكنك تفعيل التتبع لكل شخص من صفحة الحضور.</p>{attendance.data?.preview && <span className="ops-preview-label">معاينة محلية</span>}</div>
          ) : <><div className="attendance-totals"><span><b>{teamCounts.present}</b> حاضر</span><span><b>{teamCounts.late}</b> متأخر</span><span><b>{teamCounts.absent}</b> لم يسجل</span></div><div className="attendance-mini-list">{teamTracked.map((member) => <div key={member.user_id}><span className={`attendance-dot attendance-dot--${!member.record_id ? 'absent' : Number(member.late_minutes) ? 'late' : 'present'}`} /><strong>{member.full_name}</strong><small>{member.check_in_at ? formatTime12(member.check_in_at) : 'لم يسجل بعد'}</small></div>)}</div></>}
        </article>

        <ERPDashboardTasks tasks={state.tasks} loading={state.loading} error={state.tasksError} onRetry={load} now={clock} />
      </section>

      <button className="ops-refresh" type="button" onClick={() => { load(); loadAttendance(); }} aria-label="تحديث لوحة العمليات"><RefreshCw size={16} /> آخر تحديث بتوقيت القاهرة</button>
      <div className="visually-hidden" role="status" aria-live="polite">{quickActionNotice}</div>
      <ERPAddBookingModal
        isOpen={createAction === 'booking'}
        returnFocusRef={bookingTriggerRef}
        onClose={() => setCreateAction('')}
        onSuccess={async () => { await load(); setQuickActionNotice('تم إنشاء الحجز وتحديث لوحة القيادة.'); }}
      />
      <ERPClientModal
        isOpen={createAction === 'client'}
        onClose={() => setCreateAction('')}
        onSuccess={() => setQuickActionNotice('تم إنشاء العميل بنجاح.')}
      />
      <ERPCreatePromotionDrawer
        isOpen={createAction === 'promotion'}
        onClose={() => setCreateAction('')}
        onSuccess={() => setQuickActionNotice('تم إنشاء العرض الحصري بنجاح.')}
      />
      <ReceivablesDialog open={receivablesDialog.open} onClose={closeReceivables} returnFocusRef={receivablesTriggerRef} view={receivablesDialog} onRetry={loadReceivables} />
      <ERPStartSessionDialog open={sessionStart.open} bookings={sessionStart.booking ? [sessionStart.booking] : []} clientName={sessionStart.booking?.client_name} contextName={state.packageMap[Number(sessionStart.booking?.client_package_id)]?.name || sessionStart.booking?.service} returnFocusRef={sessionTriggerRef} onClose={() => setSessionStart({ open: false, booking: null })} onStarted={handleSessionStarted} onCreateBooking={() => navigate('/erp/bookings')}/>
    </main>
  );
};

export default ERPDashboard;
