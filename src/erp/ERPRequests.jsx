import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, CalendarClock, CalendarDays, Check, Clock3, Eye, Inbox, RefreshCw, RotateCcw, Send, ShieldCheck, X, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useData } from '../store/DataContext';
import './ERPRequests.css';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const emptyDecision = { open: false, kind: '', action: '', item: null, charge: false, note: '' };
const time = value => value ? value.slice(0, 5) : '—';
const dateTimeLabel = value => value ? new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

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
  const [notice, setNotice] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    const queries = [
      canOperations ? supabase.from('bookings').select('*').order('date', { ascending: true }) : Promise.resolve({ data: [] }),
      canOperations ? supabase.from('reschedule_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      canFinance ? supabase.from('payment_proofs').select('id,client_id,amount,original_name,mime_type,status,admin_note,created_at').eq('status', 'pending').order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      supabase.from('clients').select('id,name,phone1'),
    ];
    const [bookingsResult, reschedulesResult, proofsResult, clientsResult] = await Promise.all(queries);
    const failed = [bookingsResult, reschedulesResult, proofsResult, clientsResult].find(result => result.error);
    if (failed?.error) setError(failed.error.message || 'تعذر تحميل الطلبات.');
    else setData({ bookings: bookingsResult.data || [], reschedules: reschedulesResult.data || [], proofs: proofsResult.data || [], clients: clientsResult.data || [] });
    setLoading(false);
  }, [canFinance, canOperations]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, [fetchRequests]);

  const pendingBookings = data.bookings.filter(item => item.status === 'pending');
  const cancellations = data.bookings.filter(item => ['cancel_requested', 'late_cancel_requested'].includes(item.status));
  const bookingById = id => data.bookings.find(item => Number(item.id) === Number(id));
  const clientName = id => data.clients.find(item => Number(item.id) === Number(id))?.name || 'عميل';
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

  const openDecision = (kind, action, item, charge = false) => setDecision({ open: true, kind, action, item, charge, note: '' });

  const submitDecision = async event => {
    event.preventDefault();
    setDecisionBusy(true);
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
      payload = { approve: decision.action === 'approve', charge: decision.action === 'approve' && decision.charge, reason: decision.note };
    } else if (decision.kind === 'proof') {
      path = `/payment-proofs/${decision.item.id}/decision`;
      payload = { action: decision.action, note: decision.note };
    }
    const { error: requestError } = await supabase.request(path, { method: 'POST', body: JSON.stringify(payload) });
    setDecisionBusy(false);
    if (requestError) {
      setError(requestError.message || 'تعذر حفظ القرار.');
      return;
    }
    setDecision(emptyDecision);
    setNotice('تم حفظ القرار وتحديث صندوق الطلبات.');
    window.setTimeout(() => setNotice(''), 4000);
    await fetchRequests();
    window.dispatchEvent(new CustomEvent('erpRequestsUpdated'));
  };

  const requiresExceptionReason = decision.kind === 'cancellation' && decision.action === 'approve' && !decision.charge;

  return <div className="requests-center" dir="rtl">
    <header className="requests-header">
      <div><span className="requests-eyebrow"><Inbox size={16}/> مركز عمليات MT</span><h2>صندوق الطلبات</h2><p>راجع طلبات العملاء واتخذ القرار من مساحة واحدة واضحة وآمنة.</p></div>
      <button className="requests-refresh" onClick={fetchRequests} disabled={loading}><RefreshCw size={17} className={loading ? 'requests-spin' : ''}/> تحديث</button>
    </header>

    <section className="requests-summary" aria-label="ملخص الطلبات">
      <article className="total"><Inbox/><div><span>إجمالي قيد المراجعة</span><strong>{total}</strong></div></article>
      {tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setActiveTab(key)} className={activeTab === key ? 'active' : ''}><Icon/><div><span>{label}</span><strong>{counts[key]}</strong></div></button>)}
    </section>

    {notice && <div className="requests-notice success" role="status"><Check/> {notice}</div>}
    {error && <div className="requests-notice error" role="alert"><AlertTriangle/> <span>{error}</span><button onClick={fetchRequests}>إعادة المحاولة</button></div>}

    <nav className="requests-tabs" aria-label="أنواع الطلبات">
      {tabs.map(({ key, label, icon: Icon }) => <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}><Icon/>{label}<span>{counts[key]}</span></button>)}
    </nav>

    <main className="requests-workspace">
      {loading ? <LoadingState/> : <>
        {activeTab === 'bookings' && <RequestGrid empty={!pendingBookings.length} emptyLabel="لا توجد حجوزات جديدة بانتظار التأكيد.">{pendingBookings.map(item => <RequestCard key={item.id} tone="amber" icon={CalendarDays} title={item.client_name} badge="بانتظار التأكيد" meta={[item.date, `${time(item.start_time)} – ${time(item.end_time)}`, item.service]} note={item.notes}><button className="approve" onClick={() => openDecision('booking', 'confirm', item)}><Check/> تأكيد</button><button className="alternative" onClick={() => navigate('/erp/bookings')}><CalendarClock/> موعد بديل</button><button className="reject" onClick={() => openDecision('booking', 'reject', item)}><X/> رفض</button></RequestCard>)}</RequestGrid>}

        {activeTab === 'reschedules' && <RequestGrid empty={!data.reschedules.length} emptyLabel="لا توجد طلبات تغيير موعد.">{data.reschedules.map(item => { const old = bookingById(item.booking_id); return <RequestCard key={item.id} tone="blue" icon={RotateCcw} title={clientName(item.client_id)} badge="طلب تغيير" meta={[]} note={item.reason}><div className="requests-time-change"><div><span>الموعد الحالي</span><strong>{old?.date || '—'}</strong><small>{time(old?.start_time)} – {time(old?.end_time)}</small></div><i>←</i><div><span>الموعد المقترح</span><strong>{item.proposed_date}</strong><small>{time(item.proposed_start_time)} – {time(item.proposed_end_time)}</small></div></div><button className="approve" onClick={() => openDecision('reschedule', 'approve', item)}><Check/> قبول التغيير</button><button className="reject" onClick={() => openDecision('reschedule', 'reject', item)}><X/> رفض</button></RequestCard>})}</RequestGrid>}

        {activeTab === 'cancellations' && <RequestGrid empty={!cancellations.length} emptyLabel="لا توجد طلبات إلغاء قيد المراجعة.">{cancellations.map(item => { const late = item.status === 'late_cancel_requested'; return <RequestCard key={item.id} tone={late ? 'red' : 'amber'} icon={XCircle} title={item.client_name} badge={late ? 'أقل من 48 ساعة' : 'ضمن مهلة 48 ساعة'} meta={[item.date, `${time(item.start_time)} – ${time(item.end_time)}`, `${Number(item.requested_quantity || 0)} ساعة`]} note={item.notes}>{isOwner ? <><button className="reject" onClick={() => openDecision('cancellation', 'approve', item, true)}><Clock3/> قبول مع الخصم</button><button className="approve" onClick={() => openDecision('cancellation', 'approve', item, false)}><ShieldCheck/> قبول دون خصم</button><button className="neutral" onClick={() => openDecision('cancellation', 'reject', item)}><X/> رفض الإلغاء</button></> : <p className="requests-owner-only"><ShieldCheck/> قرار الخصم أو الاستثناء متاح للمالك فقط.</p>}</RequestCard>})}</RequestGrid>}

        {activeTab === 'proofs' && <RequestGrid empty={!data.proofs.length} emptyLabel="لا توجد إثباتات تحويل قيد المراجعة.">{data.proofs.map(item => <RequestCard key={item.id} tone="purple" icon={Banknote} title={clientName(item.client_id)} badge="إثبات جديد" meta={[`${Number(item.amount).toLocaleString('ar-EG')} ج`, dateTimeLabel(item.created_at), item.original_name]}><button className="view" onClick={() => window.open(`${API_BASE}/payment-proofs/${item.id}/file`, '_blank', 'noopener,noreferrer')}><Eye/> عرض الملف الآمن</button><button className="approve" onClick={() => openDecision('proof', 'approve', item)}><Check/> اعتماد</button><button className="reject" onClick={() => openDecision('proof', 'reject', item)}><X/> رفض</button></RequestCard>)}</RequestGrid>}
      </>}
    </main>

    {decision.open && <div className="requests-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title" onMouseDown={event => { if (event.target === event.currentTarget) setDecision(emptyDecision); }}><form className="requests-dialog" onSubmit={submitDecision}><button type="button" className="requests-dialog-close" aria-label="إغلاق" onClick={() => setDecision(emptyDecision)}><X/></button><span className={`requests-dialog-icon ${['reject'].includes(decision.action) ? 'danger' : ''}`}>{decision.action === 'reject' ? <XCircle/> : <ShieldCheck/>}</span><h3 id="decision-title">تأكيد القرار</h3><p>{decisionText(decision)}</p>{decision.kind === 'cancellation' && decision.action === 'approve' && <div className={`requests-policy-choice ${decision.charge ? 'charge' : 'exception'}`}><strong>{decision.charge ? 'سيتم خصم الساعات من الباقة' : 'لن يتم خصم الساعات من الباقة'}</strong><span>{decision.charge ? 'سيُنقل الرصيد المحجوز إلى الرصيد المستهلك.' : 'سيُعاد الرصيد المحجوز إلى رصيد العميل المتاح.'}</span></div>}<label>ملاحظة القرار {requiresExceptionReason && <b>(مطلوبة لتوثيق الاستثناء)</b>}<textarea rows="3" required={requiresExceptionReason} value={decision.note} onChange={event => setDecision({ ...decision, note: event.target.value })} placeholder="اكتب سبب القرار أو ملاحظة للمتابعة"/></label><div className="requests-dialog-actions"><button type="button" onClick={() => setDecision(emptyDecision)}>تراجع</button><button type="submit" disabled={decisionBusy || (requiresExceptionReason && !decision.note.trim())} className={decision.action === 'reject' ? 'danger' : 'confirm'}>{decisionBusy ? <RefreshCw className="requests-spin"/> : <Send/>}{decisionBusy ? 'جارٍ الحفظ...' : 'تأكيد القرار'}</button></div></form></div>}
  </div>;
}

function RequestGrid({ empty, emptyLabel, children }) { return empty ? <div className="requests-empty"><Inbox/><h3>الصندوق خالٍ</h3><p>{emptyLabel}</p></div> : <section className="requests-grid">{children}</section>; }
function LoadingState() { return <div className="requests-empty"><RefreshCw className="requests-spin"/><h3>جارٍ تحميل الطلبات</h3><p>نراجع أحدث الحالات من الخادم.</p></div>; }
function RequestCard({ tone, icon: Icon, title, badge, meta, note, children }) { return <article className={`request-card ${tone}`}><header><span className="request-card-icon"><Icon/></span><div><h3>{title}</h3><span>{badge}</span></div></header>{meta?.length > 0 && <div className="request-card-meta">{meta.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}</div>}{note && <p className="request-card-note">{note}</p>}<div className="request-card-body">{children}</div></article>; }
function decisionText(decision) { const action = decision.action === 'reject' ? 'رفض' : 'اعتماد'; if (decision.kind === 'booking') return `${action === 'اعتماد' ? 'تأكيد' : 'رفض'} طلب حجز ${decision.item?.client_name}؟ سيظهر القرار للعميل فورًا.`; if (decision.kind === 'reschedule') return `${action} طلب تغيير الموعد؟ هذا الإجراء سيحدّث حالة الطلب والحجز.`; if (decision.kind === 'cancellation') return decision.action === 'reject' ? 'رفض طلب الإلغاء والإبقاء على الموعد مؤكدًا؟' : 'اعتماد إلغاء الموعد وفق سياسة الرصيد المحددة أدناه؟'; return `${action} إثبات التحويل؟ الاعتماد سينشئ دفعة وحركة مالية ولا يمكن التراجع عنه من هذه الشاشة.`; }
