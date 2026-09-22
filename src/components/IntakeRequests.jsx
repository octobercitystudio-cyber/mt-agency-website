import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, Clock3, Inbox, LoaderCircle, Package, RefreshCw, UserRound, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import { formatBookingDate, formatDurationMinutes, formatEGP, formatTime12 } from '../lib/businessFormat';
import { intakeStageReady, registrationValidityLabel } from '../lib/registrationPolicy';
import { safeUiError } from '../lib/uiError';
import './IntakeRequests.css';
const stages = [{ key: 'registration', label: 'تسجيل العميل', icon: UserRound }, { key: 'package', label: 'حجز الباقة', icon: Package }, { key: 'booking', label: 'موعد التصوير', icon: CalendarDays }];
const statuses = { pending: 'قيد المراجعة', approved: 'تمت الموافقة', rejected: 'لم تتم الموافقة', not_requested: 'غير مطلوب' };
export function IntakeRequestCards({ items = [], admin = false, onChanged }) {
  const [decision, setDecision] = useState(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault(); if (busy || !decision) return; setBusy(true); setError('');
    const response = await dataClient.request(`/intake-requests/${decision.id}/decision`, { method: 'POST', body: JSON.stringify({ stage: decision.stage, action: decision.action, note }) });
    setBusy(false);
    if (response.error) { setError(safeUiError(response.error, 'تعذر حفظ القرار. حدّث الطلب وراجع إتاحة الموعد.')); return; }
    setDecision(null); setNote(''); await onChanged?.(); window.dispatchEvent(new CustomEvent('erpRequestsUpdated'));
  };
  if (!items.length) return <div className="intake-empty"><Inbox/><h3>لا توجد طلبات تسجيل حتى الآن</h3><p>{admin ? 'ستظهر طلبات العملاء الجديدة هنا مع طلب الباقة والموعد في مكان واحد.' : 'ستظهر هنا مراحل مراجعة تسجيلك وباقتك وموعدك.'}</p></div>;
  return <div className="intake-list">{items.map(item => <article className="intake-card" key={item.id}>
    <header><span className="intake-avatar">{item.name?.trim().charAt(0)}</span><div><span className="intake-eyebrow">طلب العميل #{item.id}</span><h3>{item.name}</h3><p><bdi>{item.email}</bdi><span> · </span><bdi>{item.phone}</bdi>{item.job && <span> · {item.job}</span>}</p></div></header>
    <div className="intake-stages">{stages.map(({ key, label, icon: Icon }, index) => { const status = item[`${key}_status`] || 'not_requested'; const ready = intakeStageReady(item, key); const focused = decision?.id === item.id && decision.stage === key; return <section key={key} className={`intake-stage is-${status}`}><div className="intake-stage-title"><span className="intake-stage-number">0{index + 1}</span><Icon/><h4>{label}</h4><span className={`intake-status ${status}`}>{status === 'approved' ? <CheckCircle2/> : status === 'pending' ? <Clock3/> : null}{statuses[status]}</span></div>
      {key === 'registration' && <p>اعتماد بيانات الحساب وإضافتها إلى قاعدة العملاء.</p>}
      {key === 'package' && item.service_snapshot && <><strong className="intake-service-name">{item.service_snapshot.name}</strong><div className="intake-facts"><span>{formatDurationMinutes(Number(item.service_snapshot.total_hours) * 60)}</span><span>{registrationValidityLabel(item.service_snapshot)}</span><strong>{formatEGP(item.service_snapshot.price)}</strong></div><p>مبلغ الحجز: {formatEGP(item.service_snapshot.deposit_amount)} · {item.service_snapshot.payment_due_text}</p></>}
      {key === 'booking' && item.booking && <><strong>{formatBookingDate(item.booking.date)}</strong><p>{formatTime12(item.booking.start_time)} إلى {formatTime12(item.booking.end_time)} · {formatDurationMinutes(item.booking.duration_minutes)}</p>{status === 'pending' && <small>موعد مقترح؛ يُراجع توفره قبل التأكيد.</small>}</>}
      {item[`${key}_note`] && <p className="intake-review-note">ملاحظة الإدارة: {item[`${key}_note`]}</p>}
      {admin && status === 'pending' && !focused && <div className="intake-actions"><button className="intake-approve" disabled={!ready || busy} onClick={() => { setDecision({ id: item.id, stage: key, action: 'approve' }); setNote(''); setError(''); }}><Check/> موافقة</button><button className="intake-reject" disabled={!ready || busy} onClick={() => { setDecision({ id: item.id, stage: key, action: 'reject' }); setNote(''); setError(''); }}><X/> رفض</button>{!ready && <small>بانتظار الموافقة على {key === 'booking' ? 'الباقة' : 'تسجيل العميل'}.</small>}</div>}
      {focused && <form className="intake-decision" onSubmit={submit}><strong>{decision.action === 'approve' ? `تأكيد الموافقة على ${label}` : `تأكيد رفض ${label}`}</strong><label>ملاحظة للعميل (اختياري)<textarea autoFocus rows="2" maxLength="1000" value={note} onChange={e => setNote(e.target.value)}/></label>{error && <p role="alert" className="intake-error">{error}</p>}<div className="intake-actions"><button className={decision.action === 'approve' ? 'intake-approve' : 'intake-reject'} disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'تأكيد القرار'}</button><button type="button" disabled={busy} onClick={() => setDecision(null)}>تراجع</button></div></form>}
    </section>; })}</div></article>)}</div>;
}
export default function ClientIntakeRequests({ onRefreshSession }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => { setLoading(true); setError(''); const response = await dataClient.request('/client/intake-requests'); if (response.error) setError(safeUiError(response.error, 'تعذر تحميل طلباتك. حاول مرة أخرى.')); else setItems(response.data?.items || []); setLoading(false); if (refresh && !response.error) await onRefreshSession?.(); }, [onRefreshSession]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial remote request loading state.
    void load(); }, [load]);
  return <section className="client-intake" dir="rtl"><header className="intake-heading"><div><span className="intake-eyebrow">كل خطوة واضحة</span><h2>صندوق طلباتك</h2><p>تابع موافقة تسجيلك وباقتك وموعدك، كل طلب بحالته المستقلة.</p></div><button onClick={() => load(true)} disabled={loading}><RefreshCw/> تحديث الحالة</button></header>{error && <p className="intake-error" role="alert">{error}</p>}{loading ? <div className="intake-empty" role="status"><LoaderCircle className="intake-spin"/> جارٍ تحميل طلباتك…</div> : <IntakeRequestCards items={items}/>}</section>;
}
