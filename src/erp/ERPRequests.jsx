import VerticalBookingCalendar from '../components/VerticalBookingCalendar';
import { StudioBookingRequestCards } from '../components/StudioBookingRequests';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, CalendarClock, CalendarDays, Check, CheckCircle2, Eye, Focus, Inbox, LockKeyhole, RefreshCw, RotateCcw, Send, ShieldCheck, X, XCircle } from 'lucide-react';




import { IntakeRequestCards } from '../components/IntakeRequests';
import { dataClient } from '../dataClient';
import { useData } from '../store/DataContext';
import useChangeSync from '../hooks/useChangeSync';
import { buildCalendarRequestMarkers } from '../lib/bookingRequestCalendar';
import { safeUiError } from '../lib/uiError';
import { calculateDurationMinutes, formatBookingDate, formatDateTime12, formatDurationMinutes, formatEGP, formatPackageQuantity, formatTime12 } from '../lib/businessFormat';
import ERPPageHero from './ERPPageHero';
import { blockingBookings, candidateForRequest, getBookingAvailability, readableBookingTextColor, safeBookingColor } from './bookingAvailability';
import './ERPRequests.css';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const emptyDecision = { open: false, kind: '', action: '', item: null, charge: false, note: '' };
const time = value => formatTime12(value);
const dateTimeLabel = value => formatDateTime12(value);
const localDate = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const initialCalendarRange = () => { const now = new Date(); return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; };
const calendarDateTime = (date, value, end = false) => {
  const raw = String(value || '').slice(0, 5);
  if (end && (raw === '24:00' || raw === '00:00')) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}T00:00:00`;
  }
  return `${date}T${raw}:00`;
};
const requestedDurationMinutes = item => {
  const stored = Number(item?.duration_minutes);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  const start = item?.requested_start_time || item?.proposed_start_time || item?.scheduled_start_time || item?.start_time;
  const end = item?.requested_end_time || item?.proposed_end_time || item?.scheduled_end_time || item?.end_time;
  return calculateDurationMinutes(start, end);
};

export default function ERPRequests() {
  const { currentUser } = useData();
  const navigate = useNavigate();
  const role = currentUser?.role;
  const canOperations = ['owner', 'admin', 'operations'].includes(role);
  const canFinance = ['owner', 'admin', 'finance'].includes(role);
  const isOwner = role === 'owner';
  const [data, setData] = useState({ bookings: [], bookingBlocks: [], reschedules: [], proofs: [], clients: [], packages: [], intakes: [], intakePending: 0, studio: [], studioPending: 0 });
  const [activeTab, setActiveTab] = useState('studio');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(emptyDecision);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [checkingId, setCheckingId] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedRequestKey, setSelectedRequestKey] = useState(null);
  const [calendarRange, setCalendarRange] = useState(initialCalendarRange);
  const [loadedRange, setLoadedRange] = useState(null);
  const calendarRef = useRef(null);
  const calendarSectionRef = useRef(null);
  const fetchSequence = useRef(0);

  const fetchRequests = useCallback(async (showLoading = true) => {
    const sequence = ++fetchSequence.current;
    if (showLoading) setLoading(true);
    setError('');
    try {
    const queries = [
      canOperations ? dataClient.from('bookings').select('*').order('date', { ascending: true }) : Promise.resolve({ data: [] }),
      canOperations ? dataClient.from('reschedule_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      canFinance ? dataClient.from('payment_proofs').select('id,client_id,client_package_id,invoice_id,amount,original_name,mime_type,status,admin_note,created_at').eq('status', 'pending').order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      dataClient.from('clients').select('id,name,phone1,color'),
      canOperations ? dataClient.request(`/booking-blocks?from=${calendarRange.from}&to=${calendarRange.to}`, { method: 'GET' }) : Promise.resolve({ data: [] }),
      canOperations ? dataClient.from('client_packages').select('id,name,billing_unit') : Promise.resolve({ data: [] }),
    ];
    queries.push(canOperations ? dataClient.request('/intake-requests') : Promise.resolve({ data: { items: [], pending_count: 0 } }));
    queries.push(dataClient.request('/studio-booking-requests'));
    const [bookingsResult, reschedulesResult, proofsResult, clientsResult, blocksResult, packagesResult, intakeResult, studioResult] = await Promise.all(queries);
    if (sequence !== fetchSequence.current) return null;
    const failed = [bookingsResult, reschedulesResult, proofsResult, clientsResult, blocksResult, packagesResult, intakeResult, studioResult].find(result => result.error);
    if (failed?.error) {
      setError(safeUiError(failed.error, 'تعذر تحميل بعض الطلبات الآن. أعد المحاولة بعد قليل.'));
      setLoadedRange(null);
      setLoading(false);
      return null;
    }
    const nextData = { studio: studioResult.data?.items || [], studioPending: Number(studioResult.data?.pending_count || 0), intakes: intakeResult.data?.items || [], intakePending: Number(intakeResult.data?.pending_count || 0), bookings: bookingsResult.data || [], bookingBlocks: blocksResult.data || [], reschedules: reschedulesResult.data || [], proofs: proofsResult.data || [], clients: clientsResult.data || [], packages: packagesResult.data || [] };
    setData(nextData);
    const pendingKeys = new Set(buildCalendarRequestMarkers(nextData).map(marker => marker.requestKey));
    setSelectedRequestKey(previous => pendingKeys.has(previous) ? previous : null);
    setLoadedRange(calendarRange);
    setLoading(false);
    return nextData;
    } catch (requestError) {
      if (sequence === fetchSequence.current) {
        setError(safeUiError(requestError, 'تعذر تحديث الطلبات والإغلاقات لهذه الفترة. أعد المحاولة.'));
        setLoadedRange(null);
      }
      return null;
    } finally {
      if (sequence === fetchSequence.current) setLoading(false);
    }
  }, [canFinance, canOperations, calendarRange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests(true);
  }, [fetchRequests]);

  useChangeSync(topics => { if (topics.some(topic => ['bookings', 'requests', 'clients', 'payments'].includes(topic))) void fetchRequests(false); });
  useEffect(() => { const reload = () => { void fetchRequests(false); }; window.addEventListener('erpRequestsUpdated', reload); return () => window.removeEventListener('erpRequestsUpdated', reload); }, [fetchRequests]);
  const requestMarkers = useMemo(() => buildCalendarRequestMarkers(data), [data]);
  const selectedMarkers = requestMarkers.filter(marker => marker.requestKey === selectedRequestKey);

  const pendingBookings = data.bookings.filter(item => item.status === 'pending').map(item => ({ ...item, duration_minutes: requestedDurationMinutes(item) }));
  const cancellations = data.bookings.filter(item => ['cancel_requested', 'late_cancel_requested'].includes(item.status));
  const bookingById = id => data.bookings.find(item => Number(item.id) === Number(id));
  const clientName = id => data.clients.find(item => Number(item.id) === Number(id))?.name || 'عميل';
  const clientById = id => data.clients.find(item => Number(item.id) === Number(id));
  const bookingClientName = booking => booking?.client_name || clientById(booking?.client_id)?.name || 'عميل';
  const bookingPackageName = booking => data.packages.find(item => Number(item.id) === Number(booking?.client_package_id))?.name || (booking?.client_package_id ? `باقة #${booking.client_package_id}` : 'بدون باقة');
  const requestAvailability = (kind, item, source = data) => {
    const original = kind === 'reschedule' ? source.bookings.find(booking => Number(booking.id) === Number(item.booking_id)) : item;
    const candidate = candidateForRequest(kind, item, original);
    if (source === data && (!loadedRange || candidate.date < loadedRange.from || candidate.date > loadedRange.to || error)) return { status: 'unchecked', conflicts: [], candidate };
    return getBookingAvailability(candidate, source.bookings, {
      excludeBookingId: kind === 'reschedule' ? item.booking_id : item.id,
      blocks: source.bookingBlocks,
    });
  };
  const counts = { studio: data.studioPending, intakes: data.intakePending, bookings: pendingBookings.length, reschedules: data.reschedules.length, cancellations: cancellations.length, proofs: data.proofs.length };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const tabs = useMemo(() => [
    { key: 'studio', label: 'طلبات التصوير', icon: Inbox },
    ...(canOperations ? [
      ...(data.intakes.length ? [{ key: 'intakes', label: 'تسجيلات سابقة', icon: Inbox }] : []),
      { key: 'bookings', label: 'حجوزات جديدة', icon: CalendarDays },
      { key: 'reschedules', label: 'تغيير المواعيد', icon: RotateCcw },
      { key: 'cancellations', label: 'طلبات الإلغاء', icon: XCircle },
    ] : []),
    ...(canFinance ? [{ key: 'proofs', label: 'إثباتات التحويل', icon: Banknote }] : []),
  ], [canFinance, canOperations, data.intakes.length]);

  const focusRequestOnCalendar = (kind, item, source = data) => {
    const markers = buildCalendarRequestMarkers(source);
    const marker = markers.find(row => row.kind === kind && String(row.requestId) === String(item.id) && row.phase !== 'from');
    if (marker) focusMarker(marker);
  };
  const focusMarker = marker => {
    setSelectedRequestKey(marker.requestKey);
    setActiveTab(marker.tab);
    window.setTimeout(() => { calendarRef.current?.getApi()?.gotoDate(marker.date); calendarSectionRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' }); }, 0);
  };
  const fetchDecisionData = async (kind, item) => {
    try {
    const fresh = await fetchRequests(false);
    if (!fresh) return null;
    const original = kind === 'reschedule' ? fresh.bookings.find(row => Number(row.id) === Number(item.booking_id)) : item;
    const candidate = candidateForRequest(kind, item, original);
    const result = await dataClient.request(`/booking-blocks?from=${candidate.date}&to=${candidate.date}`, { method: 'GET' });
    if (result.error) { setError(safeUiError(result.error, 'تعذر التحقق من الإغلاقات المؤقتة. أعد المحاولة قبل اعتماد الموعد.')); return null; }
    return { ...fresh, bookingBlocks: result.data || [] };
    } catch (requestError) { setError(safeUiError(requestError, 'تعذر التحقق من الموعد. أعد المحاولة.')); return null; }
  };

  const openDecision = async (kind, action, item, charge = false) => {
    const requiresAvailability = (kind === 'booking' && action === 'confirm') || (kind === 'reschedule' && action === 'approve');
    if (requiresAvailability) {
      setCheckingId(`${kind}-${item.id}`);
      const fresh = await fetchDecisionData(kind, item);
      setCheckingId('');
      if (!fresh) return;
      const availability = requestAvailability(kind, item, fresh);
      if (!(availability.status === 'available' || (isOwner && availability.status === 'blocked'))) {
        focusRequestOnCalendar(kind, item, fresh);
        setError(['conflict', 'blocked'].includes(availability.status) ? 'لا يمكن اعتماد الطلب: الموعد غير متاح. اختر موعدًا بديلًا.' : 'تعذر التحقق من الموعد. راجع التاريخ والتوقيت.');
        return;
      }
    }
    setDecision({ open: true, kind, action, item, charge, note: '' });
  };

  const submitDecision = async event => {
    event.preventDefault();
    setDecisionBusy(true);
    const requiresAvailability = (decision.kind === 'booking' && decision.action === 'confirm') || (decision.kind === 'reschedule' && decision.action === 'approve');
    if (requiresAvailability) {
      const fresh = await fetchDecisionData(decision.kind, decision.item);
      if (!fresh) { setDecisionBusy(false); return; }
      const availability = requestAvailability(decision.kind, decision.item, fresh);
      if (!(availability.status === 'available' || (isOwner && availability.status === 'blocked'))) {
        setDecisionBusy(false);
        setDecision(emptyDecision);
        focusRequestOnCalendar(decision.kind, decision.item, fresh);
        setError(['conflict', 'blocked'].includes(availability.status) ? 'أصبح هذا الموعد غير متاح أثناء المراجعة. لم يتم الاعتماد، ويمكنك اختيار موعد بديل.' : 'بيانات الموعد غير مكتملة، لم يتم الاعتماد.');
        return;
      }
    }
    let path = '';
    let payload = {};
    if (decision.kind === 'booking') {
      path = `/bookings/${decision.item.id}/decision`;
      payload = { action: decision.action, note: decision.note };
    } else if (decision.kind === 'reschedule') {
      path = `/reschedule-requests/${decision.item.id}/decision`;
      payload = { action: decision.action, note: decision.note };
    } else if (decision.kind === 'cancellation') {
      path = `/bookings/${decision.item.id}/cancel-decision`;
      payload = { approve: decision.action === 'approve' };
    } else if (decision.kind === 'proof') {
      path = `/payment-proofs/${decision.item.id}/decision`;
      payload = { action: decision.action, note: decision.note };
    }
    const { error: requestError } = await dataClient.request(path, { method: 'POST', body: JSON.stringify(payload) });
    setDecisionBusy(false);
    if (requestError) {
      if (requestError.code === 'booking_conflict' || requestError.status === 409) {
        setDecision(emptyDecision);
        const fresh = await fetchRequests(false);
        if (fresh) focusRequestOnCalendar(decision.kind, decision.item, fresh);
        setError('لم يتم الاعتماد لأن الموعد حُجز بالفعل. تم تحديث التقويم، اختر موعدًا بديلًا.');
      } else setError(safeUiError(requestError, 'تعذر حفظ القرار. حاول مرة أخرى.'));
      return;
    }
    setDecision(emptyDecision);
    setNotice(decision.kind === 'proof' && decision.action === 'approve'
      ? 'تم اعتماد إثبات الدفع وتسجيله إيرادًا باسم العميل والخدمة.'
      : 'تم حفظ القرار وتحديث صندوق الطلبات.');
    window.setTimeout(() => setNotice(''), 4000);
    await fetchRequests(false);
    window.dispatchEvent(new CustomEvent('erpRequestsUpdated'));
  };

  const representedBookingIds = new Set(requestMarkers.filter(marker => marker.bookingId != null && marker.phase !== 'to').map(marker => String(marker.bookingId)));
  const calendarEvents = blockingBookings(data.bookings).filter(booking => !representedBookingIds.has(String(booking.id))).map(booking => {
    const client = data.clients.find(item => Number(item.id) === Number(booking.client_id)) || data.clients.find(item => item.name === booking.client_name);
    const color = safeBookingColor(client?.color);
    return {
      id: `booking-${booking.id}`,
      title: bookingClientName(booking),
      start: calendarDateTime(booking.date, booking.start_time),
      end: calendarDateTime(booking.date, booking.end_time, true),
      backgroundColor: color,
      borderColor: color,
      textColor: readableBookingTextColor(color),
      extendedProps: { kind: 'blocking', client_color: color, status: booking.status, timeLabel: `${time(booking.start_time)} إلى ${time(booking.end_time)}` },
    };
  });
  data.bookingBlocks.forEach(block => calendarEvents.push({
    id: `block-${block.id}`,
    title: 'مغلق بواسطة الإدارة',
    start: calendarDateTime(block.block_date, block.start_time),
    end: calendarDateTime(block.block_date, block.end_time, true),
    backgroundColor: '#fff1f2', borderColor: '#c56a76', textColor: '#8d2f3d',
    extendedProps: { kind: 'booking_block', client_color: '#fff1f2', status: 'blocked', timeLabel: `${time(block.start_time)} إلى ${time(block.end_time)}` },
  }));
  requestMarkers.forEach(marker => {
    const tone = marker.kind === 'reschedule' ? 'blue' : marker.kind === 'cancellation' ? 'red' : 'amber';
    const colors = { blue: ['#edf5ff', '#2358a0'], red: ['#fff0f2', '#a52640'], amber: ['#fff6dd', '#825012'] }[tone];
    calendarEvents.push({
      id: marker.key, title: marker.clientName,
      start: calendarDateTime(marker.date, marker.start_time), end: calendarDateTime(marker.date, marker.end_time, true),
      backgroundColor: colors[0], borderColor: colors[1], textColor: colors[1],
      classNames: ['requests-calendar-pending', `request-tone-${tone}`, `request-phase-${marker.phase}`, ...(marker.requestKey === selectedRequestKey ? ['is-selected'] : [])],
      extendedProps: { kind: 'request', marker, timeLabel: `${time(marker.start_time)} إلى ${time(marker.end_time)}` },
    });
  });

  return <div className="requests-center" dir="rtl">
    <ERPPageHero
      icon={Inbox}
      eyebrow="مركز عمليات MT"
      title="صندوق الطلبات"
      description="راجع طلبات العملاء واتخذ القرار من مساحة واحدة واضحة وآمنة."
      actions={<button onClick={() => fetchRequests(true)} disabled={loading}><RefreshCw size={17} className={loading ? 'requests-spin' : ''}/> تحديث</button>}
    />

    <section className="requests-summary" aria-label="ملخص الطلبات المعلقة" style={{ '--requests-summary-columns': tabs.length + 1 }}>
      <article className="total"><Inbox/><div><span>إجمالي قيد المراجعة</span><strong>{total}</strong></div></article>
      {tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActiveTab(key)} className={activeTab === key ? 'active' : ''}><Icon/><div><span>{label}</span><strong>{counts[key]}</strong></div></button>)}
    </section>

    {notice && <div className="requests-notice success" role="status"><Check/> {notice}</div>}
    {error && <div className="requests-notice error" role="alert"><AlertTriangle/> <span>{error}</span><button onClick={fetchRequests}>إعادة المحاولة</button></div>}

    <nav className="requests-tabs" aria-label="أنواع الطلبات">
      {tabs.map(({ key, label, icon: Icon }) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}><Icon/>{label}<span>{counts[key]}</span></button>)}
    </nav>

    {canOperations && ['studio', 'bookings', 'reschedules', 'cancellations'].includes(activeTab) && <section ref={calendarSectionRef} className="requests-calendar-reference" aria-labelledby="requests-calendar-title">
      <header>
        <div><span className="requests-calendar-kicker"><CalendarClock/>الطلبات على التقويم</span><h2 id="requests-calendar-title">كل موعد وطلب تغيير أمامك</h2></div>
        <div className="requests-calendar-legend" aria-label="دليل التقويم"><span><i className="new"/>حجز ينتظر التأكيد</span><span><i className="move"/>تغيير: من ← إلى</span><span><i className="conflict"/>إلغاء قيد المراجعة</span><span><i className="occupied"/>الحجوزات بألوان العملاء</span></div>
      </header>
      <p className="requests-calendar-explainer">اضغط على الطلب لعرض تفاصيله. الموعد الحالي وطلب الإلغاء يظلان محجوزين حتى اعتماد القرار؛ الموعد المقترح لا يُعد مؤكدًا.</p>
      {(!loadedRange || loading || error) && <p className="requests-calendar-freshness" role="status">{loading ? 'جارٍ تحديث الطلبات والإغلاقات لهذه الفترة…' : 'تعذر تحديث بعض البيانات. المعروض آخر بيانات محمّلة؛ أعد التحديث قبل مراجعة الإتاحة.'}</p>}
      {!!selectedMarkers.length && <section className={`requests-calendar-selection request-tone-${selectedMarkers[0].kind === 'reschedule' ? 'blue' : selectedMarkers[0].kind === 'cancellation' ? 'red' : 'amber'}`} aria-label="تفاصيل الطلب المحدد" aria-live="polite">
        <header><div><span>الطلب المحدد · بانتظار قرار الإدارة</span><h3>{selectedMarkers[0].clientName}</h3></div><button type="button" onClick={() => setSelectedRequestKey(null)} aria-label="إغلاق تفاصيل الطلب"><X size={18}/></button></header>
        <div className="requests-calendar-selection-slots">{selectedMarkers.map(marker => <article key={marker.key}><strong>{marker.label}</strong><span>{formatBookingDate(marker.date)}</span><b>{time(marker.start_time)} إلى {time(marker.end_time)}</b><button type="button" onClick={() => calendarRef.current?.getApi()?.gotoDate(marker.date)}><Focus size={16}/>{marker.phase === 'from' ? 'اذهب للموعد الحالي' : marker.phase === 'to' ? 'اذهب للموعد الجديد' : 'اذهب ليوم الطلب'}</button></article>)}</div>
        <button type="button" className="requests-review-link" onClick={() => document.getElementById(`request-card-${selectedMarkers[0].kind}-${selectedMarkers[0].requestId}`)?.scrollIntoView({ block: 'center', behavior: 'auto' })}>مراجعة الطلب واتخاذ القرار ↓</button>
      </section>}
      <div className="requests-calendar-shell" aria-label="تقويم مرجع الحجوزات">
        <VerticalBookingCalendar
          ref={calendarRef} label="تقويم الطلبات العمودي" events={calendarEvents}
          datesSet={info => { const end = new Date(info.end); end.setDate(end.getDate() - 1); const next = { from: localDate(info.start), to: localDate(end) }; setCalendarRange(previous => previous.from === next.from && previous.to === next.to ? previous : next); }}
          eventClick={info => { if (info.event.extendedProps.marker) focusMarker(info.event.extendedProps.marker); }}
          emptyText={loading ? 'جارٍ تحميل الطلبات والإغلاقات…' : !loadedRange || error ? 'لا توجد بيانات مكتملة لهذا اليوم؛ أعد التحديث قبل مراجعة الإتاحة.' : 'لا توجد مواعيد أو طلبات ظاهرة لهذا اليوم؛ تُراجع الإتاحة قبل التأكيد.'}
          eventContent={arg => <div className="requests-calendar-event" style={{ color: arg.event.textColor }}>{arg.event.extendedProps.marker && <small className="requests-marker-label">{arg.event.extendedProps.marker.label}</small>}{arg.event.extendedProps.kind === 'booking_block' && <LockKeyhole/>}<strong>{arg.event.title}</strong><span>{arg.event.extendedProps.timeLabel}</span>{arg.event.extendedProps.marker?.counterpart && <small>{arg.event.extendedProps.marker.phase === 'from' ? 'إلى: ' : 'من: '}{formatBookingDate(arg.event.extendedProps.marker.counterpart.date)} · {time(arg.event.extendedProps.marker.counterpart.start_time)}</small>}</div>}
        />
      </div>
      <p className="requests-calendar-scroll-hint">الأيام مرتبة رأسيًا. انتقل لأي شهر أو أسبوع، واضغط على الطلب لعرض تفاصيله.</p>
    </section>}

    <main className="requests-workspace">
      {loading ? <LoadingState/> : <>
        {activeTab === 'studio' && <><p className="requests-intake-caption"><strong>{data.studio.filter(item => item.package_status === 'pending' || item.bookings.some(row => row.status === 'pending')).length} طلب تصوير بانتظار المراجعة</strong><span>العداد يجمع قرارات الباقات والمواعيد المعلقة؛ كل موعد له قرار مستقل.</span></p><StudioBookingRequestCards items={data.studio} role={role} onChanged={() => fetchRequests(false)} onFocusAppointment={(parent, appointment) => { const marker = requestMarkers.find(row => row.kind === 'studio' && String(row.requestId) === String(parent.id) && String(row.appointmentId) === String(appointment.id)); if (marker) focusMarker(marker); }}/></>}
        {activeTab === 'intakes' && <><p className="requests-intake-caption"><strong>{data.intakes.filter(item => ['registration', 'package', 'booking'].some(stage => item[`${stage}_status`] === 'pending')).length} عميل بانتظار المراجعة</strong><span>كل عميل في بطاقة واحدة. الأرقام في العدادات تمثل طلبات التسجيل والباقة والموعد المعلقة، وكل طلب يُحسب مرة واحدة.</span></p><IntakeRequestCards items={data.intakes} admin onChanged={() => fetchRequests(false)}/></>}
        {activeTab === 'bookings' && <RequestGrid empty={!pendingBookings.length} emptyLabel="لا توجد حجوزات جديدة بانتظار التأكيد.">{pendingBookings.map(item => { const availability = requestAvailability('booking', item); const blocked = !(availability.status === 'available' || (isOwner && availability.status === 'blocked')); return <RequestCard key={item.id} tone="amber" icon={CalendarDays} title={item.client_name} badge="بانتظار التأكيد" meta={[bookingPackageName(item), item.service, formatBookingDate(item.date), `${time(item.start_time)} – ${time(item.end_time)}`, `المدة المطلوبة: ${formatDurationMinutes(item.duration_minutes || 0)}`]} note={item.notes} requestId={`request-card-booking-${item.id}`}><button className="calendar-focus" onClick={() => focusRequestOnCalendar('booking', item)}><Focus/> عرض على التقويم</button><AvailabilityStrip availability={availability} candidate={candidateForRequest('booking', item)} clientLabel={bookingClientName}/><button className="approve" disabled={blocked || checkingId === `booking-${item.id}`} title={blocked ? 'لا يمكن التأكيد قبل اختيار موعد متاح' : ''} onClick={() => openDecision('booking', 'confirm', item)}><Check/> {checkingId === `booking-${item.id}` ? 'جارٍ التحقق...' : 'تأكيد'}</button><button className="alternative" onClick={() => navigate('/erp/bookings')}><CalendarClock/> موعد بديل</button><button className="reject" onClick={() => openDecision('booking', 'reject', item)}><X/> رفض</button></RequestCard>})}</RequestGrid>}

        {activeTab === 'reschedules' && <RequestGrid empty={!data.reschedules.length} emptyLabel="لا توجد طلبات تغيير موعد.">{data.reschedules.map(item => { const old = bookingById(item.booking_id); const availability = requestAvailability('reschedule', item); const candidate = candidateForRequest('reschedule', item, old); const blocked = !(availability.status === 'available' || (isOwner && availability.status === 'blocked')); return <RequestCard key={item.id} tone="blue" icon={RotateCcw} title={clientName(item.client_id)} badge="طلب تغيير" meta={[]} note={item.reason} requestId={`request-card-reschedule-${item.id}`}><div className="requests-time-change"><div><span>الموعد الحالي</span><strong>{formatBookingDate(old?.date)}</strong><small>{time(old?.start_time)} – {time(old?.end_time)}</small></div><i>←</i><div><span>الموعد المقترح</span><strong>{formatBookingDate(item.proposed_date)}</strong><small>{time(item.proposed_start_time)} – {time(item.proposed_end_time)}</small></div></div><button className="calendar-focus" onClick={() => focusRequestOnCalendar('reschedule', item)}><Focus/> عرض على التقويم</button><AvailabilityStrip availability={availability} candidate={candidate} clientLabel={bookingClientName}/><button className="approve" disabled={blocked || checkingId === `reschedule-${item.id}`} title={blocked ? 'لا يمكن قبول موعد متعارض' : ''} onClick={() => openDecision('reschedule', 'approve', item)}><Check/> {checkingId === `reschedule-${item.id}` ? 'جارٍ التحقق...' : 'قبول التغيير'}</button><button className="reject" onClick={() => openDecision('reschedule', 'reject', item)}><X/> رفض</button></RequestCard>})}</RequestGrid>}

        {activeTab === 'cancellations' && <RequestGrid empty={!cancellations.length} emptyLabel="لا توجد طلبات حذف قيد المراجعة.">{cancellations.map(item => { const late = item.status === 'late_cancel_requested'; return <RequestCard key={item.id} tone={late ? 'red' : 'amber'} requestId={`request-card-cancellation-${item.id}`} icon={XCircle} title={item.client_name} badge="طلب حذف موعد" meta={[formatBookingDate(item.date), `${time(item.start_time)} – ${time(item.end_time)}`, formatPackageQuantity(item.requested_quantity, 'hour')]}><button className="calendar-focus" onClick={() => focusRequestOnCalendar('cancellation', item)}><Focus/> عرض طلب الإلغاء على التقويم</button>{isOwner ? <><button className="approve" onClick={() => openDecision('cancellation', 'approve', item)}><ShieldCheck/> حذف الموعد</button><button className="neutral" onClick={() => openDecision('cancellation', 'reject', item)}><X/> الإبقاء على الموعد</button></> : <p className="requests-owner-only"><ShieldCheck/> قرار حذف الموعد متاح للمالك فقط.</p>}</RequestCard>})}</RequestGrid>}

        {activeTab === 'proofs' && <RequestGrid empty={!data.proofs.length} emptyLabel="لا توجد إثباتات تحويل قيد المراجعة.">{data.proofs.map(item => <RequestCard key={item.id} tone="purple" icon={Banknote} title={clientName(item.client_id)} badge="إثبات جديد" meta={[formatEGP(item.amount), item.client_package_id ? `باقة #${item.client_package_id}` : `فاتورة #${item.invoice_id}`, dateTimeLabel(item.created_at), item.original_name]}><button className="view" onClick={() => window.open(`${API_BASE}/payment-proofs/${item.id}/file`, '_blank', 'noopener,noreferrer')}><Eye/> عرض الملف الآمن</button>{isOwner ? <><button className="approve" onClick={() => openDecision('proof', 'approve', item)}><Check/> اعتماد</button><button className="reject" onClick={() => openDecision('proof', 'reject', item)}><X/> رفض</button></> : <p className="requests-owner-only"><ShieldCheck/> القرار النهائي بالاعتماد أو الرفض متاح للمالك فقط.</p>}</RequestCard>)}</RequestGrid>}
      </>}
    </main>

    {decision.open && <div className="requests-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title" onMouseDown={event => { if (event.target === event.currentTarget) setDecision(emptyDecision); }}><form className="requests-dialog" onSubmit={submitDecision}><button type="button" className="requests-dialog-close" aria-label="إغلاق" onClick={() => setDecision(emptyDecision)}><X/></button><span className={`requests-dialog-icon ${['reject'].includes(decision.action) ? 'danger' : ''}`}>{decision.action === 'reject' ? <XCircle/> : <ShieldCheck/>}</span><h3 id="decision-title">تأكيد القرار</h3><p>{decisionText(decision)}</p>{decision.kind === 'cancellation' && decision.action === 'approve' && <div className="requests-policy-choice exception"><strong>سيُحذف الموعد نهائيًا</strong><span>سيعود الرصيد المحجوز إلى رصيد العميل، ولن يُطلب أو يُحفظ سبب للحذف.</span></div>}{decision.kind !== 'cancellation' && <label>ملاحظة القرار<textarea rows="3" value={decision.note} onChange={event => setDecision({ ...decision, note: event.target.value })} placeholder="اكتب ملاحظة للمتابعة"/></label>}<div className="requests-dialog-actions"><button type="button" onClick={() => setDecision(emptyDecision)}>تراجع</button><button type="submit" disabled={decisionBusy} className={decision.action === 'reject' ? 'danger' : 'confirm'}>{decisionBusy ? <RefreshCw className="requests-spin"/> : <Send/>}{decisionBusy ? 'جارٍ الحفظ...' : 'تأكيد القرار'}</button></div></form></div>}
  </div>;
}

function RequestGrid({ empty, emptyLabel, children }) { return empty ? <div className="requests-empty"><Inbox/><h3>الصندوق خالٍ</h3><p>{emptyLabel}</p></div> : <section className="requests-grid">{children}</section>; }
function LoadingState() { return <div className="requests-empty"><RefreshCw className="requests-spin"/><h3>جارٍ تحميل الطلبات</h3><p>نراجع أحدث الحالات من الخادم.</p></div>; }
function RequestCard({ tone, icon: Icon, title, badge, meta, note, children, requestId }) { return <article id={requestId} className={`request-card ${tone}`}><header><span className="request-card-icon"><Icon/></span><div><h3>{title}</h3><span>{badge}</span></div></header>{meta?.length > 0 && <div className="request-card-meta">{meta.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}</div>}{note && <p className="request-card-note">{note}</p>}<div className="request-card-body">{children}</div></article>; }
function AvailabilityStrip({ availability, candidate, clientLabel }) {
  const first = availability.conflicts[0];
  const extra = Math.max(0, availability.conflicts.length - 1);
  if (availability.status === 'unchecked') return <div className="request-availability invalid" role="status"><CalendarClock/><div><strong>الإتاحة تحتاج إلى مراجعة</strong><span>اعرض يوم الطلب على التقويم لتحميل الإغلاقات والمواعيد المحدثة.</span></div></div>;
  if (availability.status === 'invalid') return <div className="request-availability invalid" role="status" aria-live="polite"><AlertTriangle/><div><strong>تعذر التحقق من الموعد</strong><span>راجع التاريخ ووقت البداية والنهاية قبل الاعتماد.</span></div></div>;
  if (availability.status === 'blocked') return <div className="request-availability conflict" role="status" aria-live="polite"><LockKeyhole/><div><strong>مغلق بواسطة الإدارة</strong><span>تتقاطع الفترة المقترحة مع إغلاق إداري. اختر موعدًا آخر.</span></div></div>;
  if (availability.status === 'conflict') return <div className="request-availability conflict" role="status" aria-live="polite"><AlertTriangle/><div><strong>الموعد غير متاح</strong><span>يتعارض مع حجز {clientLabel(first)} من {time(first.start_time)} إلى {time(first.end_time)}{extra ? ` · و${extra} تعارض إضافي` : ''}.</span></div></div>;
  return <div className="request-availability available" role="status" aria-live="polite"><CheckCircle2/><div><strong>الموعد متاح</strong><span>{formatBookingDate(candidate.date)} · {time(candidate.start_time)} إلى {time(candidate.end_time)}</span></div></div>;
}
function decisionText(decision) { const action = decision.action === 'reject' ? 'رفض' : 'اعتماد'; if (decision.kind === 'booking') return `${action === 'اعتماد' ? 'تأكيد' : 'رفض'} طلب حجز ${decision.item?.client_name}؟ سيظهر القرار للعميل فورًا.`; if (decision.kind === 'reschedule') return `${action} طلب تغيير الموعد؟ هذا الإجراء سيحدّث حالة الطلب والحجز.`; if (decision.kind === 'cancellation') return decision.action === 'reject' ? 'رفض طلب الإلغاء والإبقاء على الموعد مؤكدًا؟' : 'اعتماد إلغاء الموعد وفق سياسة الرصيد المحددة أدناه؟'; return `${action} إثبات التحويل؟ الاعتماد سينشئ دفعة وحركة مالية ولا يمكن التراجع عنه من هذه الشاشة.`; }
