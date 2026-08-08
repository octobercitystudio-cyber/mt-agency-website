import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, BadgeDollarSign, CalendarDays, Check, Clock3,
  FileCheck2, PackageCheck, Plus, RefreshCw, TimerOff, UserPlus, UsersRound,
} from 'lucide-react';
import { supabase, dataProvider } from '../supabaseClient';
import { useData } from '../store/DataContext';
import { attendanceApi } from '../lib/attendanceApi';
import { formatBookingDate, formatEGP, formatTime12, timeToMinutes } from '../lib/businessFormat';
import ERPPageHero from './ERPPageHero';
import useChangeSync from '../hooks/useChangeSync';
import './ERPDashboard.css';
import './ERPDashboardFixes.css';

const cairoDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const cairoMonth = () => cairoDate().slice(0, 7);
const money = (value) => formatEGP(value, { maximumFractionDigits: 0 });
const roleLabels = { owner: 'مالك', admin: 'مدير', operations: 'تشغيل', finance: 'مالية', staff: 'موظف' };
const statusLabels = {
  pending: 'بانتظار التأكيد', confirmed: 'مؤكد', in_progress: 'جارٍ الآن', completed: 'مكتمل',
  cancelled: 'ملغي', cancel_requested: 'طلب إلغاء', late_cancel_requested: 'إلغاء متأخر',
};
const normalizeStatus = (status = '') => ({ 'قيد الانتظار': 'pending', 'مؤكد': 'confirmed', 'ملغي': 'cancelled' }[status] || status);

const ERPDashboard = () => {
  const { currentUser } = useData();
  const navigate = useNavigate();
  const [clock, setClock] = useState(new Date());
  const [state, setState] = useState({ loading: true, error: '', bookings: [], actions: [], tasks: [], health: {} });
  const [attendance, setAttendance] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setState((old) => ({ ...old, loading: true, error: '' }));
    const today = cairoDate(); const month = cairoMonth();
    try {
      const [bookingsResult, pendingBookings, reschedules, proofs, finance, packages, invoices, tasks] = await Promise.all([
        supabase.from('bookings').select('*').eq('date', today).order('start_time', { ascending: true }),
        supabase.from('bookings').select('id,client_name,status,date,start_time').in('status', ['pending', 'cancel_requested', 'late_cancel_requested']).limit(8),
        supabase.from('reschedule_requests').select('id,booking_id,client_id,status,proposed_date,proposed_start_time').eq('status', 'pending').limit(8),
        supabase.from('payment_proofs').select('id,client_id,amount,status,created_at').eq('status', 'pending').limit(8),
        supabase.from('finance').select('id,type,entry_kind,amount,date').like('date', `${month}%`),
        supabase.from('client_packages').select('id,status,expires_at,total_price,overage_amount,paid_amount,source_invoice_id').eq('status', 'active'),
        supabase.from('invoices').select('id,total,paid_amount,status'),
        supabase.from('reminders').select('id,title,due_date,type,status,amount').eq('status', 'pending').order('due_date', { ascending: true }).limit(6),
      ]);
      const failedModules = [bookingsResult, pendingBookings, reschedules, proofs, finance, packages, invoices, tasks].filter((result) => result.error);
      if (failedModules.length) console.error('Dashboard data modules unavailable:', failedModules.map((result) => result.error));
      const actions = [
        ...(pendingBookings.data || []).map((item) => ({ ...item, kind: 'booking', title: `${statusLabels[normalizeStatus(item.status)] || 'طلب حجز'} — ${item.client_name}`, meta: `${formatBookingDate(item.date)} · ${formatTime12(item.start_time, '')}`, to: '/erp/requests' })),
        ...(reschedules.data || []).map((item) => ({ ...item, kind: 'reschedule', title: 'طلب تغيير موعد', meta: `${formatBookingDate(item.proposed_date)} · ${formatTime12(item.proposed_start_time, '')}`, to: '/erp/requests' })),
        ...(proofs.data || []).map((item) => ({ ...item, kind: 'payment', title: 'إثبات تحويل يحتاج مراجعة', meta: money(item.amount), to: '/erp/requests' })),
      ].slice(0, 8);
      let cashIn = 0; let cashOut = 0;
      (finance.data || []).forEach((entry) => {
        if (['income', 'transfer_in', 'advance_in'].includes(entry.entry_kind) || ['إيراد', 'سداد سلفة', 'income'].includes(entry.type)) cashIn += Number(entry.amount || 0);
        else cashOut += Number(entry.amount || 0);
      });
      const invoiceOutstanding = (invoices.data || []).filter((invoice) => !['cancelled', 'void'].includes(invoice.status)).reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total || 0) - Number(invoice.paid_amount || 0)), 0);
      const packageOnlyOutstanding = (packages.data || []).reduce((sum, pkg) => {
        const total = Number(pkg.total_price || 0); const paid = Number(pkg.paid_amount || 0);
        const fullDue = Math.max(0, total + Number(pkg.overage_amount || 0) - paid);
        return sum + (pkg.source_invoice_id ? Math.max(0, fullDue - Math.max(0, total - paid)) : fullDue);
      }, 0);
      const outstanding = invoiceOutstanding + packageOnlyOutstanding;
      const soon = new Date(); soon.setDate(soon.getDate() + 14); const soonDate = cairoDate(soon);
      setState({
        loading: false,
        error: failedModules.length ? 'تعذر تحميل بعض بيانات التشغيل الآن. يمكنك متابعة الأقسام المتاحة أو إعادة المحاولة.' : '',
        bookings: (bookingsResult.data || []).filter((booking) => normalizeStatus(booking.status) !== 'cancelled'), actions,
        tasks: tasks.data || [],
        health: { outstanding, cashIn, cashOut, activePackages: (packages.data || []).length, expiringSoon: (packages.data || []).filter((item) => item.expires_at && item.expires_at <= soonDate).length },
      });
    } catch (error) {
      console.error('Dashboard load failed:', error);
      setState((old) => ({ ...old, loading: false, error: 'تعذر تحميل بيانات التشغيل الآن. تحقق من الاتصال ثم أعد المحاولة.' }));
    }
  }, []);

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

  useEffect(() => { load(); loadAttendance(); }, [load, loadAttendance]);
  useChangeSync(useCallback((topics) => {
    if (topics.some(topic => ['bookings', 'client_packages', 'finance', 'notifications'].includes(topic))) load();
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

  return (
    <main className="ops-dashboard" aria-busy={state.loading}>
      <ERPPageHero
        className="ops-commandbar"
        identityClassName="ops-commandbar__identity"
        eyebrow="مركز عمليات MT Agency"
        title={`أهلًا، ${currentUser?.full_name || 'مستخدم النظام'}`}
        description={<>{roleLabels[currentUser?.role] || currentUser?.role} · {new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', weekday: 'long', day: 'numeric', month: 'long' }).format(clock)} · <bdi>{new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' }).format(clock)}</bdi></>}
        actions={<>
          <Link data-variant="primary" className="ops-action ops-action--primary" to="/erp/bookings" state={{ openCreateBooking: true }}><Plus size={17} /> حجز جديد</Link>
          <Link className="ops-action" to="/erp/clients" state={{ openCreateClient: true }}><UserPlus size={17} /> عميل جديد</Link>
          {['owner','admin'].includes(currentUser?.role) && <Link className="ops-action" to="/erp/offers" state={{ openCreatePromotion: true }}><FileCheck2 size={17} /> عرض حصري</Link>}
        </>}
        details={<div className="ops-attendance-chip">
          <div><span>حضورك اليوم</span><strong>{attendance.loading ? 'جارٍ التحقق…' : !attendance.data?.self?.tracked ? 'غير خاضع للتتبع' : selfRecord?.check_out_at ? 'تم الانصراف' : selfRecord ? `دخول ${formatTime12(selfRecord.check_in_at)}` : 'لم يُسجل'}</strong></div>
          {selfRecord && !selfRecord.check_out_at && <button type="button" onClick={checkOut}><TimerOff size={16} /> تسجيل الانصراف</button>}
        </div>}
      />

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
                {timelineBookings.length === 0 && <button className="runway-empty-slot" type="button" onClick={() => navigate('/erp/bookings', { state: { openCreateBooking: true } })}><CalendarDays size={24} /><strong>اليوم متاح بالكامل</strong><small>12:00 م — 12:00 ص</small><span><Plus size={15} /> إضافة أول حجز</span></button>}
                {timelineBookings.map((booking, index) => (
                  <button key={booking.id} className={`runway-booking runway-booking--${booking.normalizedStatus}`} style={{ top: `${booking.top}%`, height: `${booking.height}%`, insetInlineStart: `${(index % 2) * 48}%`, width: timelineBookings.length > 1 ? '47%' : '96%' }} onClick={() => navigate('/erp/bookings')}>
                    <span className="runway-booking__time"><bdi>{formatTime12(booking.start)}–{formatTime12(booking.end)}</bdi></span>
                    <strong>{booking.client_name}</strong><small>{booking.service || 'تصوير استديو'} · {booking.resource_name || 'الاستديو الرئيسي'}</small>
                    <em>{statusLabels[booking.normalizedStatus] || booking.status}</em>
                  </button>
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

      <section className="ops-health" aria-label="صحة العمل">
        <div><span>مستحقات غير محصلة</span><strong>{state.loading ? '—' : money(state.health.outstanding)}</strong><small>من الفواتير النشطة</small></div>
        <div><span>صافي حركة الشهر</span><strong className={(state.health.cashIn - state.health.cashOut) < 0 ? 'negative' : ''}>{state.loading ? '—' : money(state.health.cashIn - state.health.cashOut)}</strong><small>دخل {money(state.health.cashIn)} · خرج {money(state.health.cashOut)}</small></div>
        <div><span>الباقات الفعالة</span><strong>{state.loading ? '—' : state.health.activePackages || 0}</strong><small><PackageCheck size={14} /> {state.health.expiringSoon || 0} تنتهي خلال 14 يومًا</small></div>
      </section>

      <section className="ops-grid-lower">
        <article className="ops-panel ops-attendance">
          <div className="ops-panel__heading"><div><span className="ops-kicker">فريق العمل</span><h2>الحضور اليوم</h2></div><Link to="/erp/attendance">السجل الكامل <ArrowLeft size={16} /></Link></div>
          {attendance.error ? <div className="ops-inline-error">{attendance.error}</div> : attendance.loading ? <div className="ops-skeleton ops-skeleton--list" /> : teamTracked.length === 0 ? (
            <div className="ops-empty ops-empty--compact"><UsersRound size={28} /><h3>لا يوجد موظفون خاضعون للحضور</h3><p>المالكان معفيان افتراضيًا. يمكنك تفعيل التتبع لكل شخص من صفحة الحضور.</p>{attendance.data?.preview && <span className="ops-preview-label">معاينة محلية</span>}</div>
          ) : <><div className="attendance-totals"><span><b>{teamCounts.present}</b> حاضر</span><span><b>{teamCounts.late}</b> متأخر</span><span><b>{teamCounts.absent}</b> لم يسجل</span></div><div className="attendance-mini-list">{teamTracked.map((member) => <div key={member.user_id}><span className={`attendance-dot attendance-dot--${!member.record_id ? 'absent' : Number(member.late_minutes) ? 'late' : 'present'}`} /><strong>{member.full_name}</strong><small>{member.check_in_at ? formatTime12(member.check_in_at) : 'لم يسجل بعد'}</small></div>)}</div></>}
        </article>

        <article className="ops-panel ops-deliveries">
          <div className="ops-panel__heading"><div><span className="ops-kicker">القادم</span><h2>مهام وتسليمات</h2></div><Link to="/erp/reminders">كل المهام <ArrowLeft size={16} /></Link></div>
          {state.loading ? <div className="ops-skeleton ops-skeleton--list" /> : state.tasks.length === 0 ? <div className="ops-empty ops-empty--compact"><Check size={27} /><h3>لا توجد مهام قريبة</h3><p>أضف مهمة أو موعد تسليم ليظهر هنا.</p></div> : <div className="delivery-list">{state.tasks.map((task) => <Link to="/erp/reminders" key={task.id}><time>{task.due_date ? new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(task.due_date)) : 'دون موعد'}</time><div><strong>{task.title}</strong><small>{task.type || 'مهمة تشغيل'}</small></div><ArrowLeft size={15} /></Link>)}</div>}
        </article>
      </section>

      <button className="ops-refresh" type="button" onClick={() => { load(); loadAttendance(); }} aria-label="تحديث لوحة العمليات"><RefreshCw size={16} /> آخر تحديث بتوقيت القاهرة</button>
    </main>
  );
};

export default ERPDashboard;
