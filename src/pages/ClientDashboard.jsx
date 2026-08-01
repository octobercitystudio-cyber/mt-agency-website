import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign,
  Clock3, Eye, FileCheck2, FileText, FileUp, Home, LogOut, Package, ReceiptText, RefreshCw, RotateCcw, Send, X, XCircle
} from 'lucide-react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import './ClientDashboard.css';

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

const initialBooking = { client_package_id: '', date: '', start_time: '12:00', end_time: '13:00', notes: '' };
const initialReschedule = { booking: null, date: '', start_time: '12:00', end_time: '13:00', reason: '' };

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status || 'غير محدد', tone: 'neutral' };
  return <span className={`client-status client-status--${meta.tone}`}>{meta.label}</span>;
};

const timeLabel = (value) => value ? value.slice(0, 5) : '--:--';
const quantityLabel = (pkg, value) => `${Number(value || 0).toLocaleString('ar-EG')} ${pkg?.billing_unit === 'reel' ? 'ريل' : 'ساعة'}`;
const effectiveOfferStatus = offer => {
  if (offer?.status !== 'sent' || !offer.valid_until) return offer?.status;
  return new Date(`${offer.valid_until}T23:59:59`) < new Date() ? 'expired' : 'sent';
};

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { currentUser, logout } = useData();
  const clientId = currentUser?.client_id;
  const [activeTab, setActiveTab] = useState('home');
  const [client, setClient] = useState(null);
  const [packages, setPackages] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [services, setServices] = useState([]);
  const [offers, setOffers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [bookingForm, setBookingForm] = useState(initialBooking);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [reschedule, setReschedule] = useState(initialReschedule);
  const [actionBusy, setActionBusy] = useState(null);
  const [proofForm, setProofForm] = useState({ amount: '', file: null });
  const [proofBusy, setProofBusy] = useState(false);
  const [offerDetail, setOfferDetail] = useState(null);
  const [offerDetailBusy, setOfferDetailBusy] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptConfirm, setAcceptConfirm] = useState(false);
  const offerDialogRef = useRef(null);
  const offerTriggerRef = useRef(null);

  const fetchClientData = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setLoadError('');
    const [clientResult, packagesResult, bookingsResult, paymentsResult, proofsResult, servicesResult, offersResult, invoicesResult] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('client_packages').select('*').eq('client_id', clientId).order('expires_at', { ascending: true }),
      supabase.from('bookings').select('*').eq('client_id', clientId).order('date', { ascending: false }),
      supabase.from('payments').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('payment_proofs').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('services').select('*').eq('is_active', 1),
      supabase.from('offers').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', clientId).order('issued_at', { ascending: false }),
    ]);
    const error = [clientResult, packagesResult, bookingsResult, paymentsResult, proofsResult, servicesResult, offersResult, invoicesResult].find(result => result.error)?.error;
    if (error) {
      setLoadError(error.message || 'تعذر تحميل بيانات حسابك. حاول مرة أخرى.');
    } else {
      setClient(clientResult.data);
      setPackages(packagesResult.data || []);
      setBookings(bookingsResult.data || []);
      setPayments(paymentsResult.data || []);
      setProofs(proofsResult.data || []);
      setServices(servicesResult.data || []);
      setOffers((offersResult.data || []).filter(offer => offer.status !== 'draft').map(offer => ({ ...offer, status: effectiveOfferStatus(offer) })));
      setInvoices(invoicesResult.data || []);
    }
    setLoading(false);
  }, [clientId]);

  // The dashboard data is remote session state and must be synchronized on identity change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchClientData(); }, [fetchClientData]);

  const activePackages = useMemo(() => packages.filter(pkg => pkg.status === 'active'), [packages]);
  const upcomingBookings = useMemo(() => bookings
    .filter(item => new Date(`${item.date}T${timeLabel(item.start_time)}`) >= new Date() && !['rejected', 'completed'].includes(item.status))
    .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)), [bookings]);

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 6 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 6 }),
  }), [currentMonth]);

  const selectedBookings = bookings.filter(item => isSameDay(new Date(`${item.date}T12:00:00`), selectedDay));

  const serviceForPackage = (pkg) => services.find(service => Number(service.id) === Number(pkg.service_id));

  const showNotice = (type, message) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    const pkg = activePackages.find(item => String(item.id) === String(bookingForm.client_package_id));
    if (!pkg) return showNotice('error', 'اختر الباقة التي تريد الحجز منها.');
    const start = new Date(`2000-01-01T${bookingForm.start_time}:00`);
    const end = new Date(`2000-01-01T${bookingForm.end_time}:00`);
    const minutes = (end - start) / 60000;
    if (bookingForm.start_time < '12:00' || bookingForm.end_time > '22:00' || minutes < 60 || minutes % 15 !== 0) {
      return showNotice('error', 'راجع الوقت: أقل حجز ساعة، والزيادة كل 15 دقيقة، من 12 ظهرًا إلى 10 مساءً.');
    }
    const service = serviceForPackage(pkg);
    setBookingBusy(true);
    const { error } = await supabase.request('/bookings/request', {
      method: 'POST',
      body: JSON.stringify({
        client_package_id: Number(pkg.id), service_id: service?.id || pkg.service_id,
        service: pkg.name, date: bookingForm.date, start_time: bookingForm.start_time,
        end_time: bookingForm.end_time, notes: bookingForm.notes,
      }),
    });
    setBookingBusy(false);
    if (error) return showNotice('error', error.message || 'تعذر إرسال طلب الحجز.');
    setBookingForm(initialBooking);
    showNotice('success', 'تم إرسال طلب الحجز، وحالته الآن بانتظار التأكيد.');
    await fetchClientData();
  };

  const submitReschedule = async (event) => {
    event.preventDefault();
    setActionBusy(`reschedule-${reschedule.booking.id}`);
    const { error } = await supabase.request('/reschedule-requests', {
      method: 'POST', body: JSON.stringify({ booking_id: reschedule.booking.id, date: reschedule.date,
        start_time: reschedule.start_time, end_time: reschedule.end_time, reason: reschedule.reason }),
    });
    setActionBusy(null);
    if (error) return showNotice('error', error.message || 'تعذر إرسال طلب تغيير الموعد.');
    setReschedule(initialReschedule);
    showNotice('success', 'تم إرسال طلب تغيير الموعد للإدارة.');
  };

  const requestCancel = async (booking) => {
    const reason = window.prompt('سبب الإلغاء (اختياري):') ?? null;
    if (reason === null) return;
    setActionBusy(`cancel-${booking.id}`);
    const { error } = await supabase.request(`/bookings/${booking.id}/cancel-request`, {
      method: 'POST', body: JSON.stringify({ reason }),
    });
    setActionBusy(null);
    if (error) return showNotice('error', error.message || 'تعذر إرسال طلب الإلغاء.');
    showNotice('success', 'تم إرسال طلب الإلغاء للإدارة.');
    await fetchClientData();
  };

  const uploadProof = async (event) => {
    event.preventDefault();
    if (!proofForm.file) return;
    const body = new FormData();
    body.append('amount', proofForm.amount);
    body.append('proof', proofForm.file);
    setProofBusy(true);
    const { error } = await supabase.request('/payment-proofs', { method: 'POST', body });
    setProofBusy(false);
    if (error) return showNotice('error', error.message || 'تعذر رفع إثبات التحويل.');
    setProofForm({ amount: '', file: null });
    showNotice('success', 'تم رفع الإثبات وسيظهر كقيد المراجعة.');
    await fetchClientData();
  };

  const viewClientOffer = async (event, offer) => {
    offerTriggerRef.current = event.currentTarget;
    setOfferDetail({ id: offer.id });
    setOfferDetailBusy(true);
    const { data, error } = await supabase.request(`/offers/${offer.id}`, { method: 'GET' });
    setOfferDetailBusy(false);
    if (error) {
      setOfferDetail(null);
      showNotice('error', error.message || 'تعذر تحميل تفاصيل العرض.');
      return;
    }
    setOfferDetail(data);
  };

  const closeOfferDetail = useCallback(() => { setOfferDetail(null); setAcceptConfirm(false); }, []);
  const offerDetailId = offerDetail?.id;

  useEffect(() => {
    if (!offerDetailId) return undefined;
    const dialog = offerDialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []);
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeOfferDetail(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable(); if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => focusable()[0]?.focus());
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; requestAnimationFrame(() => offerTriggerRef.current?.focus()); };
  }, [offerDetailId, closeOfferDetail]);

  const acceptOffer = async () => {
    if (!offerDetail) return;
    setAcceptBusy(true);
    const { error } = await supabase.request(`/offers/${offerDetail.id}/accept`, { method: 'POST', body: '{}' });
    setAcceptBusy(false);
    if (error) return showNotice('error', error.message || 'تعذر قبول العرض.');
    closeOfferDetail();
    showNotice('success', 'تم قبول العرض وإنشاء الفاتورة والباقات بنجاح.');
    await fetchClientData();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!clientId) return <div className="client-state"><Clock3 /><p>جارٍ التحقق من الجلسة...</p></div>;
  if (loading && !client) return <div className="client-state"><RefreshCw className="client-spin" /><p>نجهز لوحة حسابك...</p></div>;
  if (loadError && !client) return <div className="client-state client-state--error"><XCircle /><h2>تعذر تحميل لوحة الحساب</h2><p>{loadError}</p><button onClick={fetchClientData}>إعادة المحاولة</button></div>;

  return (
    <div className="client-app" dir="rtl">
      <aside className="client-sidebar">
        <div className="client-brand"><img src="/logo.webp" alt="MT Agency" /><div><strong>MT Agency</strong><span>مساحة العميل</span></div></div>
        <nav aria-label="التنقل الرئيسي">
          {[
            ['home', Home, 'الرئيسية'], ['packages', Package, 'باقاتي'],
            ['schedule', CalendarDays, 'المواعيد'], ['offers', FileText, 'العروض والفواتير'], ['finance', CircleDollarSign, 'المدفوعات'],
          ].map(([key, Icon, label]) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}><Icon size={19}/><span>{label}</span></button>)}
        </nav>
        <button className="client-logout" onClick={handleLogout}><LogOut size={18}/> تسجيل الخروج</button>
      </aside>

      <main className="client-main">
        <header className="client-topbar">
          <div><span className="client-eyebrow">مساحة العميل الخاصة</span><h1>أهلًا، {client?.name || currentUser?.full_name}</h1><p>تابع باقاتك ومواعيدك وحالتك المالية من مكان واحد.</p></div>
          <button className="client-primary" onClick={() => setActiveTab('schedule')}><CalendarDays size={18}/> طلب حجز جديد</button>
        </header>

        {notice && <div className={`client-notice client-notice--${notice.type}`} role="status">{notice.message}</div>}
        {loadError && <div className="client-notice client-notice--error">تعذر تحديث بعض البيانات. <button onClick={fetchClientData}>حاول مجددًا</button></div>}

        {activeTab === 'home' && <section className="client-view">
          <div className="client-summary">
            <article><Package/><span>الباقات الفعالة</span><strong>{activePackages.length}</strong></article>
            <article><CalendarDays/><span>المواعيد القادمة</span><strong>{upcomingBookings.length}</strong></article>
            <article><Clock3/><span>الرصيد المتاح</span><strong>{activePackages.reduce((sum, pkg) => sum + Math.max(0, Number(pkg.purchased_quantity) - Number(pkg.held_quantity) - Number(pkg.consumed_quantity)), 0).toLocaleString('ar-EG')}</strong></article>
          </div>
          <div className="client-home-grid">
            <section className="client-panel client-next">
              <div className="client-section-head"><div><span>الخطوة التالية</span><h2>موعدك القادم</h2></div><button onClick={() => setActiveTab('schedule')}>عرض التقويم</button></div>
              {upcomingBookings[0] ? <div className="client-next-booking">
                <div className="client-date-block"><strong>{format(new Date(`${upcomingBookings[0].date}T12:00`), 'd')}</strong><span>{format(new Date(`${upcomingBookings[0].date}T12:00`), 'MMM', { locale: ar })}</span></div>
                <div><StatusBadge status={upcomingBookings[0].status}/><h3>{upcomingBookings[0].service}</h3><p><Clock3 size={16}/>{timeLabel(upcomingBookings[0].start_time)} – {timeLabel(upcomingBookings[0].end_time)}</p></div>
              </div> : <div className="client-empty"><CalendarDays/><h3>لا يوجد موعد قادم</h3><p>يمكنك إرسال طلب حجز من باقتك الفعالة.</p><button onClick={() => setActiveTab('schedule')}>اطلب موعدًا</button></div>}
            </section>
            <section className="client-panel"><div className="client-section-head"><div><span>رصيدك</span><h2>الباقات الفعالة</h2></div><button onClick={() => setActiveTab('packages')}>عرض الكل</button></div>
              <div className="client-package-mini-list">{activePackages.slice(0, 3).map(pkg => {
                const available = Math.max(0, Number(pkg.purchased_quantity) - Number(pkg.held_quantity) - Number(pkg.consumed_quantity));
                const percent = Math.min(100, ((Number(pkg.consumed_quantity) + Number(pkg.held_quantity)) / Math.max(1, Number(pkg.purchased_quantity))) * 100);
                return <article key={pkg.id}><div><strong>{pkg.name}</strong><span>متاح {quantityLabel(pkg, available)}</span></div><div className="client-progress"><i style={{ width: `${percent}%` }}/></div><small>تنتهي {format(new Date(`${pkg.expires_at}T12:00`), 'd MMMM yyyy', { locale: ar })}</small></article>;
              })}{!activePackages.length && <div className="client-empty client-empty--compact"><Package/><p>لا توجد باقة فعالة حاليًا.</p></div>}</div>
            </section>
          </div>
        </section>}

        {activeTab === 'packages' && <section className="client-view">
          <div className="client-page-title"><span>كل رصيدك في مكان واحد</span><h2>باقاتي</h2><p>الحجز المعلّق لا يخصم من الرصيد إلا بعد تأكيد الإدارة.</p></div>
          <div className="client-packages-grid">{packages.map(pkg => {
            const available = Math.max(0, Number(pkg.purchased_quantity) - Number(pkg.held_quantity) - Number(pkg.consumed_quantity));
            return <article className="client-package-card" key={pkg.id}><div className="client-package-card-top"><StatusBadge status={pkg.status === 'active' ? 'confirmed' : pkg.status}/><span>#{pkg.id}</span></div><h3>{pkg.name}</h3><div className="client-package-balance"><strong>{quantityLabel(pkg, available)}</strong><span>متبقي من {quantityLabel(pkg, pkg.purchased_quantity)}</span></div><dl><div><dt>محجوز</dt><dd>{quantityLabel(pkg, pkg.held_quantity)}</dd></div><div><dt>مستخدم</dt><dd>{quantityLabel(pkg, pkg.consumed_quantity)}</dd></div><div><dt>المدفوع</dt><dd>{Number(pkg.paid_amount).toLocaleString('ar-EG')} ج</dd></div><div><dt>الانتهاء</dt><dd>{pkg.expires_at}</dd></div></dl>{pkg.status === 'active' && <button onClick={() => { setBookingForm(prev => ({ ...prev, client_package_id: String(pkg.id) })); setActiveTab('schedule'); }}>حجز من هذه الباقة</button>}</article>;
          })}{!packages.length && <div className="client-panel client-empty"><Package/><h3>لا توجد باقات بعد</h3><p>ستظهر الباقات المضافة إلى حسابك هنا.</p></div>}</div>
        </section>}

        {activeTab === 'schedule' && <section className="client-view client-schedule-layout">
          <div className="client-schedule-main">
            <div className="client-page-title"><span>الطلب ← الانتظار ← القرار</span><h2>المواعيد والحجوزات</h2><p>حالة كل طلب تظهر فور مراجعتها من الإدارة.</p></div>
            <div className="client-calendar-panel">
              <div className="client-calendar-head"><button aria-label="الشهر التالي" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight/></button><h3>{format(currentMonth, 'MMMM yyyy', { locale: ar })}</h3><button aria-label="الشهر السابق" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft/></button></div>
              <div className="client-weekdays">{['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'].map(day => <span key={day}>{day}</span>)}</div>
              <div className="client-calendar-grid">{calendarDays.map(day => {
                const dayBookings = bookings.filter(item => isSameDay(new Date(`${item.date}T12:00`), day));
                return <button key={day.toISOString()} className={`${!isSameMonth(day, currentMonth) ? 'outside' : ''} ${isSameDay(day, selectedDay) ? 'selected' : ''}`} onClick={() => setSelectedDay(day)}><span className="client-day-number">{format(day, 'd')}</span><span className="client-day-events">{dayBookings.slice(0, 2).map(item => <i className={`event-${STATUS_META[item.status]?.tone || 'neutral'}`} key={item.id}>{timeLabel(item.start_time)} · {item.client_name || 'حجزك'}</i>)}{dayBookings.length > 2 && <em>+{dayBookings.length - 2}</em>}</span></button>;
              })}</div>
            </div>
            <section className="client-panel client-day-list"><div className="client-section-head"><div><span>تفاصيل اليوم</span><h2>{format(selectedDay, 'EEEE d MMMM', { locale: ar })}</h2></div></div>
              {selectedBookings.map(booking => <BookingRow key={booking.id} booking={booking} busy={actionBusy} onReschedule={() => setReschedule({ ...initialReschedule, booking, date: booking.date, start_time: timeLabel(booking.start_time), end_time: timeLabel(booking.end_time) })} onCancel={() => requestCancel(booking)}/>) }
              {!selectedBookings.length && <div className="client-empty client-empty--compact"><CalendarDays/><p>لا توجد حجوزات في هذا اليوم.</p></div>}
            </section>
            <section className="client-panel client-booking-history"><div className="client-section-head"><div><span>سجل الطلبات</span><h2>كل الحجوزات</h2></div></div>{bookings.map(booking => <BookingRow key={booking.id} booking={booking} busy={actionBusy} onReschedule={() => setReschedule({ ...initialReschedule, booking, date: booking.date, start_time: timeLabel(booking.start_time), end_time: timeLabel(booking.end_time) })} onCancel={() => requestCancel(booking)}/>)}{!bookings.length && <div className="client-empty"><CalendarDays/><h3>لم تطلب أي حجز بعد</h3></div>}</section>
          </div>
          <aside className="client-request-card"><div className="client-request-title"><span><Send size={15}/> طلب جديد</span><h2>احجز موعد تصوير</h2><p>اختر باقتك ثم أرسل الوقت المناسب لك.</p></div><form onSubmit={submitBooking}>
            <label>الباقة<select required value={bookingForm.client_package_id} onChange={e => setBookingForm({ ...bookingForm, client_package_id: e.target.value })}><option value="">اختر الباقة</option>{activePackages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}</select></label>
            <label>التاريخ<input required type="date" min={format(new Date(), 'yyyy-MM-dd')} value={bookingForm.date} onChange={e => setBookingForm({ ...bookingForm, date: e.target.value })}/></label>
            <div className="client-time-fields"><label>من<input required type="time" min="12:00" max="21:00" step="900" value={bookingForm.start_time} onChange={e => setBookingForm({ ...bookingForm, start_time: e.target.value })}/></label><label>إلى<input required type="time" min="13:00" max="22:00" step="900" value={bookingForm.end_time} onChange={e => setBookingForm({ ...bookingForm, end_time: e.target.value })}/></label></div>
            <p className="client-policy"><Clock3 size={17}/> مواعيد العمل من 12 ظهرًا إلى 10 مساءً. أقل حجز ساعة، وبعدها يمكن الزيادة كل 15 دقيقة.</p>
            <label>ملاحظات<textarea rows="3" value={bookingForm.notes} onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })} placeholder="تفاصيل تساعدنا في تجهيز الجلسة"/></label>
            <button className="client-primary" disabled={bookingBusy || !activePackages.length}>{bookingBusy ? <RefreshCw className="client-spin"/> : <Send/>}{bookingBusy ? 'جارٍ الإرسال...' : 'إرسال طلب الحجز'}</button>
            {!activePackages.length && <small className="client-field-error">يلزم وجود باقة فعالة لإرسال طلب حجز.</small>}
          </form></aside>
        </section>}

        {activeTab === 'offers' && <section className="client-view">
          <div className="client-page-title"><span>من العرض إلى التنفيذ</span><h2>العروض والفواتير</h2><p>راجع عروض الأسعار المرسلة إليك، واقبل المناسب منها لإنشاء الفاتورة وباقات الخدمات.</p></div>
          <div className="client-commercial-grid">
            <section className="client-panel"><div className="client-section-head"><div><span>عروض MT Agency</span><h2>عروض الأسعار</h2></div><strong className="client-commercial-count">{offers.length}</strong></div><div className="client-offer-list">{offers.map(offer => <article key={offer.id}><header><div><span>{offer.offer_number}</span><h3>{offer.title}</h3></div><ClientOfferStatus status={offer.status}/></header><div className="client-offer-value"><span>القيمة النهائية</span><strong>{Number(offer.total).toLocaleString('ar-EG')} ج</strong></div><div className="client-offer-meta"><span>صالح حتى {offer.valid_until || 'غير محدد'}</span>{offer.discount > 0 && <span>خصم {Number(offer.discount).toLocaleString('ar-EG')} ج</span>}</div><button onClick={event => viewClientOffer(event, offer)}><Eye/> عرض التفاصيل {offer.status === 'sent' ? 'والقبول' : ''}</button></article>)}{!offers.length && <div className="client-empty"><FileText/><h3>لا توجد عروض مرسلة حاليًا</h3><p>سيظهر عرض السعر هنا فور إرساله من الإدارة.</p></div>}</div></section>
            <section className="client-panel"><div className="client-section-head"><div><span>المستندات المالية</span><h2>الفواتير</h2></div><strong className="client-commercial-count">{invoices.length}</strong></div><div className="client-invoice-list">{invoices.map(invoice => { const due = Math.max(0, Number(invoice.total) - Number(invoice.paid_amount)); return <article key={invoice.id}><header><div><span>{invoice.invoice_number}</span><h3>{Number(invoice.total).toLocaleString('ar-EG')} ج</h3></div><ClientInvoiceStatus status={invoice.status}/></header><dl><div><dt>مدفوع</dt><dd>{Number(invoice.paid_amount).toLocaleString('ar-EG')} ج</dd></div><div><dt>متبقي</dt><dd className={due ? 'due' : ''}>{due.toLocaleString('ar-EG')} ج</dd></div><div><dt>تاريخ الإصدار</dt><dd>{invoice.issued_at}</dd></div><div><dt>الاستحقاق</dt><dd>{invoice.due_at || '—'}</dd></div></dl></article> })}{!invoices.length && <div className="client-empty"><ReceiptText/><h3>لا توجد فواتير بعد</h3><p>تُنشأ الفاتورة تلقائيًا بعد قبول عرض السعر.</p></div>}</div></section>
          </div>
        </section>}

        {activeTab === 'finance' && <section className="client-view">
          <div className="client-page-title"><span>حالة الحساب</span><h2>المدفوعات وإثباتات التحويل</h2><p>ارفع صورة التحويل أو ملف PDF، وسيظل محفوظًا حتى تراجعه الإدارة.</p></div>
          <div className="client-finance-layout"><section className="client-panel"><div className="client-section-head"><div><span>السجل المالي</span><h2>المدفوعات</h2></div></div><div className="client-money-list">{payments.map(payment => <article key={payment.id}><CheckCircle2/><div><strong>{Number(payment.amount).toLocaleString('ar-EG')} ج</strong><span>{payment.method || 'تحويل'} · {format(new Date(payment.created_at), 'd MMM yyyy', { locale: ar })}</span></div><StatusBadge status={payment.status === 'approved' ? 'confirmed' : payment.status}/></article>)}{!payments.length && <div className="client-empty"><CircleDollarSign/><h3>لا توجد مدفوعات مسجلة</h3></div>}</div></section>
            <section className="client-panel client-proof-panel"><div className="client-section-head"><div><span>إثبات التحويل</span><h2>رفع إثبات جديد</h2></div></div><form onSubmit={uploadProof}><label>المبلغ<input required type="number" min="1" value={proofForm.amount} onChange={e => setProofForm({ ...proofForm, amount: e.target.value })} placeholder="مثال: 1500"/></label><label className="client-file-input"><FileUp/><span>{proofForm.file?.name || 'اختر صورة أو PDF (حتى 5MB)'}</span><input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setProofForm({ ...proofForm, file: e.target.files?.[0] || null })}/></label><button className="client-primary" disabled={proofBusy}>{proofBusy ? <RefreshCw className="client-spin"/> : <FileUp/>}{proofBusy ? 'جارٍ الرفع...' : 'رفع الإثبات'}</button></form><div className="client-proof-list">{proofs.map(proof => <article key={proof.id}><div><strong>{Number(proof.amount).toLocaleString('ar-EG')} ج</strong><span>{proof.original_name}</span></div><StatusBadge status={proof.status === 'approved' ? 'confirmed' : proof.status === 'rejected' ? 'rejected' : 'pending'}/></article>)}</div></section>
          </div>
        </section>}
      </main>

      {offerDetail && <div className="client-modal client-offer-modal" onMouseDown={event => { if (event.target === event.currentTarget) closeOfferDetail(); }}><section ref={offerDialogRef} className="client-modal-card client-offer-dialog" role="dialog" aria-modal="true" aria-labelledby="client-offer-title"><button className="client-modal-close" onClick={closeOfferDetail} aria-label="إغلاق تفاصيل العرض"><X/></button>{offerDetailBusy ? <div className="client-empty"><RefreshCw className="client-spin"/><h3>جارٍ تحميل العرض</h3></div> : <><span className="client-eyebrow"><FileCheck2/> {offerDetail.offer_number}</span><h2 id="client-offer-title">{offerDetail.title}</h2><p>صالح حتى {offerDetail.valid_until || 'غير محدد'}</p><div className="client-offer-detail-lines">{offerDetail.items?.map(item => <article key={item.id}><div><strong>{item.description}</strong><span>{Number(item.quantity).toLocaleString('ar-EG')} {item.unit === 'hour' ? 'ساعة' : item.unit === 'reel' ? 'ريل' : 'وحدة'} × {Number(item.unit_price).toLocaleString('ar-EG')} ج</span></div><b>{Number(item.total).toLocaleString('ar-EG')} ج</b></article>)}</div><div className="client-offer-detail-total"><span>الإجمالي الفرعي <b>{Number(offerDetail.subtotal).toLocaleString('ar-EG')} ج</b></span><span>الخصم <b>{Number(offerDetail.discount).toLocaleString('ar-EG')} ج</b></span><strong>القيمة النهائية <b>{Number(offerDetail.total).toLocaleString('ar-EG')} ج</b></strong></div>{offerDetail.notes && <p className="client-offer-notes">{offerDetail.notes}</p>}{offerDetail.status === 'sent' ? <div className="client-offer-accept"><p><CheckCircle2/> بقبول العرض سيتم إنشاء فاتورة وباقات الخدمات المذكورة في حسابك.</p>{acceptConfirm ? <div className="client-accept-confirm"><strong>هل تؤكد قبول العرض بالقيمة الموضحة؟</strong><div><button type="button" onClick={() => setAcceptConfirm(false)}>تراجع</button><button type="button" className="client-primary" disabled={acceptBusy} onClick={acceptOffer}>{acceptBusy ? <RefreshCw className="client-spin"/> : <CheckCircle2/>}{acceptBusy ? 'جارٍ القبول...' : 'نعم، أؤكد القبول'}</button></div></div> : <button className="client-primary" onClick={() => setAcceptConfirm(true)}><CheckCircle2/> قبول عرض السعر</button>}</div> : <div className="client-offer-accepted"><CheckCircle2/> تم قبول هذا العرض سابقًا.</div>}</>}</section></div>}

      {reschedule.booking && <div className="client-modal" role="dialog" aria-modal="true" aria-label="طلب تغيير موعد"><div className="client-modal-card"><button className="client-modal-close" onClick={() => setReschedule(initialReschedule)} aria-label="إغلاق"><XCircle/></button><span className="client-eyebrow"><RotateCcw size={15}/> تغيير الموعد</span><h2>اقترح موعدًا بديلًا</h2><p>الطلب الحالي: {reschedule.booking.date}، {timeLabel(reschedule.booking.start_time)}</p><form onSubmit={submitReschedule}><label>التاريخ الجديد<input required type="date" min={format(new Date(), 'yyyy-MM-dd')} value={reschedule.date} onChange={e => setReschedule({ ...reschedule, date: e.target.value })}/></label><div className="client-time-fields"><label>من<input required type="time" min="12:00" max="21:00" step="900" value={reschedule.start_time} onChange={e => setReschedule({ ...reschedule, start_time: e.target.value })}/></label><label>إلى<input required type="time" min="13:00" max="22:00" step="900" value={reschedule.end_time} onChange={e => setReschedule({ ...reschedule, end_time: e.target.value })}/></label></div><label>السبب<textarea rows="3" value={reschedule.reason} onChange={e => setReschedule({ ...reschedule, reason: e.target.value })}/></label><p className="client-policy"><Clock3/> تغيير أو إلغاء الموعد يكون قبل 48 ساعة. الاستثناءات تُراجع مع الإدارة.</p><button className="client-primary" disabled={Boolean(actionBusy)}><Send/> إرسال الطلب</button></form></div></div>}
    </div>
  );
}

function BookingRow({ booking, busy, onReschedule, onCancel }) {
  const canChange = ['confirmed', 'alternative_proposed'].includes(booking.status);
  const canCancel = ['pending', 'confirmed', 'alternative_proposed'].includes(booking.status);
  return <article className="client-booking-row"><div className="client-booking-date"><strong>{format(new Date(`${booking.date}T12:00`), 'd')}</strong><span>{format(new Date(`${booking.date}T12:00`), 'MMM', { locale: ar })}</span></div><div className="client-booking-info"><StatusBadge status={booking.status}/><h3>{booking.service}</h3><p><Clock3 size={15}/>{timeLabel(booking.start_time)} – {timeLabel(booking.end_time)}</p></div>{(canChange || canCancel) && <div className="client-booking-actions">{canChange && <button disabled={Boolean(busy)} onClick={onReschedule}><RotateCcw/> تغيير</button>}{canCancel && <button className="danger" disabled={Boolean(busy)} onClick={onCancel}><XCircle/> {busy === `cancel-${booking.id}` ? 'جارٍ...' : 'إلغاء'}</button>}</div>}</article>;
}

function ClientOfferStatus({ status }) {
  const states = {
    sent: ['بانتظار قبولك', 'waiting'],
    accepted: ['مقبول', 'success'],
    expired: ['منتهي الصلاحية', 'danger'],
  };
  const meta = states[status] || ['للعرض فقط', 'neutral'];
  return <span className={`client-status client-status--${meta[1]}`}>{meta[0]}</span>;
}

function ClientInvoiceStatus({ status }) {
  const paid = status === 'paid';
  return <span className={`client-status client-status--${paid ? 'success' : 'waiting'}`}>{paid ? 'مدفوعة' : 'صادرة'}</span>;
}
