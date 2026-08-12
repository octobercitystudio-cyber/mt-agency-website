import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, CalendarClock, CalendarDays, Check, CheckCircle2, Eye, Focus, Inbox, RefreshCw, RotateCcw, Send, ShieldCheck, X, XCircle } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import arCalendarLocale from '@fullcalendar/core/locales/ar';
import { dataClient } from '../dataClient';
import { useData } from '../store/DataContext';
import { safeUiError } from '../lib/uiError';
import { formatBookingDate, formatDateTime12, formatEGP, formatTime12 } from '../lib/businessFormat';
import ERPPageHero from './ERPPageHero';
import { blockingBookings, candidateForRequest, getBookingAvailability, readableBookingTextColor, safeBookingColor } from './bookingAvailability';
import './ERPRequests.css';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const emptyDecision = { open: false, kind: '', action: '', item: null, charge: false, note: '' };
const time = value => formatTime12(value);
const dateTimeLabel = value => formatDateTime12(value);
const calendarDateTime = (date, value, end = false) => {
  const raw = String(value || '').slice(0, 5);
  if (end && (raw === '24:00' || raw === '00:00')) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}T00:00:00`;
  }
  return `${date}T${raw}:00`;
};

export default function ERPRequests() {
  const { currentUser } = useData();
  const navigate = useNavigate();
  const role = currentUser?.role;
  const canOperations = ['owner', 'admin', 'operations'].includes(role);
  const canFinance = ['owner', 'admin', 'finance'].includes(role);
  const isOwner = role === 'owner';
  const [data, setData] = useState({ bookings: [], reschedules: [], proofs: [], clients: [] });
  const [activeTab, setActiveTab] = useState(canOperations ? 'bookings' : 'proofs');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState(emptyDecision);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [checkingId, setCheckingId] = useState('');
  const [notice, setNotice] = useState('');
  const [calendarPreview, setCalendarPreview] = useState(null);
  const calendarRef = useRef(null);

  const fetchRequests = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    const queries = [
      canOperations ? dataClient.from('bookings').select('*').order('date', { ascending: true }) : Promise.resolve({ data: [] }),
      canOperations ? dataClient.from('reschedule_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      canFinance ? dataClient.from('payment_proofs').select('id,client_id,client_package_id,invoice_id,amount,original_name,mime_type,status,admin_note,created_at').eq('status', 'pending').order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      dataClient.from('clients').select('id,name,phone1,color'),
    ];
    const [bookingsResult, reschedulesResult, proofsResult, clientsResult] = await Promise.all(queries);
    const failed = [bookingsResult, reschedulesResult, proofsResult, clientsResult].find(result => result.error);
    if (failed?.error) {
      setError(safeUiError(failed.error, 'تعذر تحميل بعض الطلبات الآن. أعد المحاولة بعد قليل.'));
      if (showLoading) setLoading(false);
      return null;
    }
    const nextData = { bookings: bookingsResult.data || [], reschedules: reschedulesResult.data || [], proofs: proofsResult.data || [], clients: clientsResult.data || [] };
    setData(nextData);
    if (showLoading) setLoading(false);
    return nextData;
  }, [canFinance, canOperations]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests(true);
  }, [fetchRequests]);

  const pendingBookings = data.bookings.filter(item => item.status === 'pending');
  const cancellations = data.bookings.filter(item => ['cancel_requested', 'late_cancel_requested'].includes(item.status));
  const bookingById = id => data.bookings.find(item => Number(item.id) === Number(id));
  const clientName = id => data.clients.find(item => Number(item.id) === Number(id))?.name || 'عميل';
  const clientById = id => data.clients.find(item => Number(item.id) === Number(id));
  const bookingClientName = booking => booking?.client_name || clientById(booking?.client_id)?.name || 'عميل';
  const requestAvailability = (kind, item, source = data) => {
    const original = kind === 'reschedule' ? source.bookings.find(booking => Number(booking.id) === Number(item.booking_id)) : item;
    return getBookingAvailability(candidateForRequest(kind, item, original), source.bookings, {
      excludeBookingId: kind === 'reschedule' ? item.booking_id : item.id,
    });
  };
  const counts = { bookings: pendingBookings.length, reschedules: data.reschedules.length, cancellations: cancellations.length, proofs: data.proofs.length };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const tabs = useMemo(() => [
    ...(canOperations ? [
      { key: 'bookings', label: 'حجوزات جديدة', icon: CalendarDays },
      { key: 'reschedules', label: 'تغيير المواعيد', icon: RotateCcw },
      { key: 'cancellations', label: 'طلبات الإلغاء', icon: XCircle },
    ] : []),
    ...(canFinance ? [{ key: 'proofs', label: 'إثباتات التحويل', icon: Banknote }] : []),
  ], [canFinance, canOperations]);

  const focusRequestOnCalendar = (kind, item, source = data) => {
    const original = kind === 'reschedule' ? source.bookings.find(booking => Number(booking.id) === Number(item.booking_id)) : item;
    const candidate = candidateForRequest(kind, item, original);
    const availability = requestAvailability(kind, item, source);
    setCalendarPreview({ kind, item, candidate, availability });
    if (candidate.date) window.setTimeout(() => calendarRef.current?.getApi()?.gotoDate(candidate.date), 0);
  };

  const openDecision = async (kind, action, item, charge = false) => {
    const requiresAvailability = (kind === 'booking' && action === 'confirm') || (kind === 'reschedule' && action === 'approve');
    if (requiresAvailability) {
      setCheckingId(`${kind}-${item.id}`);
      const fresh = await fetchRequests(false);
      setCheckingId('');
      if (!fresh) return;
      const availability = requestAvailability(kind, item, fresh);
      if (availability.status !== 'available') {
        focusRequestOnCalendar(kind, item, fresh);
        setError(availability.status === 'conflict' ? 'لا يمكن اعتماد الطلب: الموعد أصبح متعارضًا مع حجز آخر. اختر موعدًا بديلًا.' : 'تعذر التحقق من الموعد. راجع التاريخ والتوقيت.');
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
      const fresh = await fetchRequests(false);
      if (!fresh) { setDecisionBusy(false); return; }
      const availability = requestAvailability(decision.kind, decision.item, fresh);
      if (availability.status !== 'available') {
        setDecisionBusy(false);
        setDecision(emptyDecision);
        focusRequestOnCalendar(decision.kind, decision.item, fresh);
        setError(availability.status === 'conflict' ? 'تم حجز هذا الموعد أثناء المراجعة. لم يتم الاعتماد، ويمكنك اختيار موعد بديل.' : 'بيانات الموعد غير مكتملة، لم يتم الاعتماد.');
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

  const calendarEvents = blockingBookings(data.bookings).map(booking => {
    const client = data.clients.find(item => Number(item.id) === Number(booking.client_id)) || data.clients.find(item => item.name === booking.client_name);
    const color = safeBookingColor(client?.color);
    return {
      id: `booking-${booking.id}`,
      title: `${time(booking.start_time)} · ${bookingClientName(booking)}`,
      start: calendarDateTime(booking.date, booking.start_time),
      end: calendarDateTime(booking.date, booking.end_time, true),
      backgroundColor: color,
      borderColor: color,
      textColor: readableBookingTextColor(color),
      extendedProps: { kind: 'blocking', client_color: color, status: booking.status },
    };
  });
  if (calendarPreview?.availability?.candidate?.valid) {
    const previewColor = calendarPreview.availability.status === 'available' ? '#16895a' : '#c13a4d';
    const previewName = calendarPreview.kind === 'booking' ? calendarPreview.item.client_name : clientName(calendarPreview.item.client_id);
    calendarEvents.push({
      id: `preview-${calendarPreview.kind}-${calendarPreview.item.id}`,
      title: `معاينة · ${previewName}`,
      start: calendarDateTime(calendarPreview.candidate.date, calendarPreview.candidate.start_time),
      end: calendarDateTime(calendarPreview.candidate.date, calendarPreview.candidate.end_time, true),
      backgroundColor: previewColor,
      borderColor: previewColor,
      textColor: '#ffffff',
      classNames: ['requests-calendar-preview', `is-${calendarPreview.availability.status}`],
      extendedProps: { kind: 'preview', client_color: previewColor },
    });
  }

  return <div className="requests-center" dir="rtl">
    <ERPPageHero
      icon={Inbox}
      eyebrow="مركز عمليات MT"
      title="صندوق الطلبات"
      description="راجع طلبات العملاء واتخذ القرار من مساحة واحدة واضحة وآمنة."
      actions={<button onClick={() => fetchRequests(true)} disabled={loading}><RefreshCw size={17} className={loading ? 'requests-spin' : ''}/> تحديث</button>}
    />

    <section className="requests-summary" aria-label="ملخص الطلبات">
      <article className="total"><Inbox/><div><span>إجمالي قيد المراجعة</span><strong>{total}</strong></div></article>
      {tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActiveTab(key)} className={activeTab === key ? 'active' : ''}><Icon/><div><span>{label}</span><strong>{counts[key]}</strong></div></button>)}
    </section>

    {notice && <div className="requests-notice success" role="status"><Check/> {notice}</div>}
    {error && <div className="requests-notice error" role="alert"><AlertTriangle/> <span>{error}</span><button onClick={fetchRequests}>إعادة المحاولة</button></div>}

    <nav className="requests-tabs" aria-label="أنواع الطلبات">
      {tabs.map(({ key, label, icon: Icon }) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}><Icon/>{label}<span>{counts[key]}</span></button>)}
    </nav>

    {canOperations && ['bookings', 'reschedules'].includes(activeTab) && <section className="requests-calendar-reference" aria-labelledby="requests-calendar-title">
      <header>
        <div><span className="requests-calendar-kicker"><CalendarClock/>مرجع الحجوزات</span><h2 id="requests-calendar-title">المواعيد المشغولة في لمحة واحدة</h2></div>
        <div className="requests-calendar-legend" aria-label="دليل التقويم"><span><i className="occupied"/>مؤكد / جارٍ / إلغاء قيد المراجعة = مشغول</span><span><i className="available"/>معاينة متاحة</span><span><i className="conflict"/>معاينة متعارضة</span></div>
      </header>
      <div className="requests-calendar-shell" aria-label="تقويم مرجع الحجوزات">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          locales={[arCalendarLocale]}
          locale="ar"
          direction="rtl"
          firstDay={6}
          buttonText={{ today: 'اليوم', month: 'شهر', week: 'أسبوع' }}
          headerToolbar={{ right: 'dayGridMonth,timeGridWeek', center: 'title', left: 'prev,next today' }}
          events={calendarEvents}
          eventDisplay="block"
          slotMinTime="12:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:15:00"
          allDaySlot={false}
          height="auto"
          nowIndicator
          eventDidMount={info => {
            const background = safeBookingColor(info.event.extendedProps.client_color);
            const foreground = info.event.extendedProps.kind === 'preview' ? '#ffffff' : readableBookingTextColor(background);
            info.el.style.setProperty('--fc-event-bg-color', background);
            info.el.style.setProperty('--fc-event-border-color', background);
            info.el.style.setProperty('--fc-event-text-color', foreground);
            info.el.setAttribute('aria-label', `${info.event.title}، ${info.timeText || ''}`);
          }}
          dayCellClassNames={arg => arg.date.getDay() === 5 ? ['fc-day-fri'] : []}
          eventContent={arg => <div className="requests-calendar-event" style={{ color: arg.event.textColor }}><strong>{arg.event.title}</strong>{arg.event.extendedProps.kind === 'preview' && <small>{calendarPreview?.availability.status === 'available' ? 'الموعد متاح' : 'الموعد غير متاح'}</small>}</div>}
        />
      </div>
    </section>}

    <main className="requests-workspace">
      {loading ? <LoadingState/> : <>
        {activeTab === 'bookings' && <RequestGrid empty={!pendingBookings.length} emptyLabel="لا توجد حجوزات جديدة بانتظار التأكيد.">{pendingBookings.map(item => { const availability = requestAvailability('booking', item); const blocked = availability.status !== 'available'; return <RequestCard key={item.id} tone="amber" icon={CalendarDays} title={item.client_name} badge="بانتظار التأكيد" meta={[formatBookingDate(item.date), `${time(item.start_time)} – ${time(item.end_time)}`, item.service]} note={item.notes} onFocus={() => focusRequestOnCalendar('booking', item)}><button className="calendar-focus" onClick={() => focusRequestOnCalendar('booking', item)}><Focus/> عرض على التقويم</button><AvailabilityStrip availability={availability} candidate={candidateForRequest('booking', item)} clientLabel={bookingClientName}/><button className="approve" disabled={blocked || checkingId === `booking-${item.id}`} title={blocked ? 'لا يمكن التأكيد قبل اختيار موعد متاح' : ''} onClick={() => openDecision('booking', 'confirm', item)}><Check/> {checkingId === `booking-${item.id}` ? 'جارٍ التحقق...' : 'تأكيد'}</button><button className="alternative" onClick={() => navigate('/erp/bookings')}><CalendarClock/> موعد بديل</button><button className="reject" onClick={() => openDecision('booking', 'reject', item)}><X/> رفض</button></RequestCard>})}</RequestGrid>}

        {activeTab === 'reschedules' && <RequestGrid empty={!data.reschedules.length} emptyLabel="لا توجد طلبات تغيير موعد.">{data.reschedules.map(item => { const old = bookingById(item.booking_id); const availability = requestAvailability('reschedule', item); const candidate = candidateForRequest('reschedule', item, old); const blocked = availability.status !== 'available'; return <RequestCard key={item.id} tone="blue" icon={RotateCcw} title={clientName(item.client_id)} badge="طلب تغيير" meta={[]} note={item.reason} onFocus={() => focusRequestOnCalendar('reschedule', item)}><div className="requests-time-change"><div><span>الموعد الحالي</span><strong>{formatBookingDate(old?.date)}</strong><small>{time(old?.start_time)} – {time(old?.end_time)}</small></div><i>←</i><div><span>الموعد المقترح</span><strong>{formatBookingDate(item.proposed_date)}</strong><small>{time(item.proposed_start_time)} – {time(item.proposed_end_time)}</small></div></div><button className="calendar-focus" onClick={() => focusRequestOnCalendar('reschedule', item)}><Focus/> عرض على التقويم</button><AvailabilityStrip availability={availability} candidate={candidate} clientLabel={bookingClientName}/><button className="approve" disabled={blocked || checkingId === `reschedule-${item.id}`} title={blocked ? 'لا يمكن قبول موعد متعارض' : ''} onClick={() => openDecision('reschedule', 'approve', item)}><Check/> {checkingId === `reschedule-${item.id}` ? 'جارٍ التحقق...' : 'قبول التغيير'}</button><button className="reject" onClick={() => openDecision('reschedule', 'reject', item)}><X/> رفض</button></RequestCard>})}</RequestGrid>}

        {activeTab === 'cancellations' && <RequestGrid empty={!cancellations.length} emptyLabel="لا توجد طلبات حذف قيد المراجعة.">{cancellations.map(item => { const late = item.status === 'late_cancel_requested'; return <RequestCard key={item.id} tone={late ? 'red' : 'amber'} icon={XCircle} title={item.client_name} badge="طلب حذف موعد" meta={[formatBookingDate(item.date), `${time(item.start_time)} – ${time(item.end_time)}`, `${Number(item.requested_quantity || 0)} ساعة`]}>{isOwner ? <><button className="approve" onClick={() => openDecision('cancellation', 'approve', item)}><ShieldCheck/> حذف الموعد</button><button className="neutral" onClick={() => openDecision('cancellation', 'reject', item)}><X/> الإبقاء على الموعد</button></> : <p className="requests-owner-only"><ShieldCheck/> قرار حذف الموعد متاح للمالك فقط.</p>}</RequestCard>})}</RequestGrid>}

        {activeTab === 'proofs' && <RequestGrid empty={!data.proofs.length} emptyLabel="لا توجد إثباتات تحويل قيد المراجعة.">{data.proofs.map(item => <RequestCard key={item.id} tone="purple" icon={Banknote} title={clientName(item.client_id)} badge="إثبات جديد" meta={[formatEGP(item.amount), item.client_package_id ? `باقة #${item.client_package_id}` : `فاتورة #${item.invoice_id}`, dateTimeLabel(item.created_at), item.original_name]}><button className="view" onClick={() => window.open(`${API_BASE}/payment-proofs/${item.id}/file`, '_blank', 'noopener,noreferrer')}><Eye/> عرض الملف الآمن</button>{isOwner ? <><button className="approve" onClick={() => openDecision('proof', 'approve', item)}><Check/> اعتماد</button><button className="reject" onClick={() => openDecision('proof', 'reject', item)}><X/> رفض</button></> : <p className="requests-owner-only"><ShieldCheck/> القرار النهائي بالاعتماد أو الرفض متاح للمالك فقط.</p>}</RequestCard>)}</RequestGrid>}
      </>}
    </main>

    {decision.open && <div className="requests-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title" onMouseDown={event => { if (event.target === event.currentTarget) setDecision(emptyDecision); }}><form className="requests-dialog" onSubmit={submitDecision}><button type="button" className="requests-dialog-close" aria-label="إغلاق" onClick={() => setDecision(emptyDecision)}><X/></button><span className={`requests-dialog-icon ${['reject'].includes(decision.action) ? 'danger' : ''}`}>{decision.action === 'reject' ? <XCircle/> : <ShieldCheck/>}</span><h3 id="decision-title">تأكيد القرار</h3><p>{decisionText(decision)}</p>{decision.kind === 'cancellation' && decision.action === 'approve' && <div className="requests-policy-choice exception"><strong>سيُحذف الموعد نهائيًا</strong><span>سيعود الرصيد المحجوز إلى رصيد العميل، ولن يُطلب أو يُحفظ سبب للحذف.</span></div>}{decision.kind !== 'cancellation' && <label>ملاحظة القرار<textarea rows="3" value={decision.note} onChange={event => setDecision({ ...decision, note: event.target.value })} placeholder="اكتب ملاحظة للمتابعة"/></label>}<div className="requests-dialog-actions"><button type="button" onClick={() => setDecision(emptyDecision)}>تراجع</button><button type="submit" disabled={decisionBusy} className={decision.action === 'reject' ? 'danger' : 'confirm'}>{decisionBusy ? <RefreshCw className="requests-spin"/> : <Send/>}{decisionBusy ? 'جارٍ الحفظ...' : 'تأكيد القرار'}</button></div></form></div>}
  </div>;
}

function RequestGrid({ empty, emptyLabel, children }) { return empty ? <div className="requests-empty"><Inbox/><h3>الصندوق خالٍ</h3><p>{emptyLabel}</p></div> : <section className="requests-grid">{children}</section>; }
function LoadingState() { return <div className="requests-empty"><RefreshCw className="requests-spin"/><h3>جارٍ تحميل الطلبات</h3><p>نراجع أحدث الحالات من الخادم.</p></div>; }
function RequestCard({ tone, icon: Icon, title, badge, meta, note, children, onFocus }) { return <article className={`request-card ${tone}`} onFocusCapture={onFocus}><header><span className="request-card-icon"><Icon/></span><div><h3>{title}</h3><span>{badge}</span></div></header>{meta?.length > 0 && <div className="request-card-meta">{meta.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}</div>}{note && <p className="request-card-note">{note}</p>}<div className="request-card-body">{children}</div></article>; }
function AvailabilityStrip({ availability, candidate, clientLabel }) {
  const first = availability.conflicts[0];
  const extra = Math.max(0, availability.conflicts.length - 1);
  if (availability.status === 'invalid') return <div className="request-availability invalid" role="status" aria-live="polite"><AlertTriangle/><div><strong>تعذر التحقق من الموعد</strong><span>راجع التاريخ ووقت البداية والنهاية قبل الاعتماد.</span></div></div>;
  if (availability.status === 'conflict') return <div className="request-availability conflict" role="status" aria-live="polite"><AlertTriangle/><div><strong>الموعد غير متاح</strong><span>يتعارض مع حجز {clientLabel(first)} من {time(first.start_time)} إلى {time(first.end_time)}{extra ? ` · و${extra} تعارض إضافي` : ''}.</span></div></div>;
  return <div className="request-availability available" role="status" aria-live="polite"><CheckCircle2/><div><strong>الموعد متاح</strong><span>{formatBookingDate(candidate.date)} · {time(candidate.start_time)} إلى {time(candidate.end_time)}</span></div></div>;
}
function decisionText(decision) { const action = decision.action === 'reject' ? 'رفض' : 'اعتماد'; if (decision.kind === 'booking') return `${action === 'اعتماد' ? 'تأكيد' : 'رفض'} طلب حجز ${decision.item?.client_name}؟ سيظهر القرار للعميل فورًا.`; if (decision.kind === 'reschedule') return `${action} طلب تغيير الموعد؟ هذا الإجراء سيحدّث حالة الطلب والحجز.`; if (decision.kind === 'cancellation') return decision.action === 'reject' ? 'رفض طلب الإلغاء والإبقاء على الموعد مؤكدًا؟' : 'اعتماد إلغاء الموعد وفق سياسة الرصيد المحددة أدناه؟'; return `${action} إثبات التحويل؟ الاعتماد سينشئ دفعة وحركة مالية ولا يمكن التراجع عنه من هذه الشاشة.`; }
