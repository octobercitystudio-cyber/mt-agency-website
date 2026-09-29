import { useCallback, useEffect, useState } from 'react';
import { Clock3, XCircle } from 'lucide-react';
import { dataClient } from '../dataClient';
import useChangeSync from '../hooks/useChangeSync';
import { formatBookingDate, formatTime12 } from '../lib/businessFormat';
import './ClientPendingAppointmentRequests.css';

const labels = { booking: 'طلب حجز موعد جديد', studio: 'طلب موعد ضمن باقة جديدة', reschedule: 'طلب تغيير موعد', cancellation: 'طلب إلغاء موعد' };
export default function ClientPendingAppointmentRequests({ onChanged }) {
  const [items, setItems] = useState([]); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [confirm, setConfirm] = useState(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const result = await dataClient.request('/client/appointment-requests'); if (result.error) setError(result.error.message || 'تعذر تحميل الطلبات المنتظرة.'); else { setItems(result.data?.items || []); setError(''); } }, []);
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect
  useChangeSync(useCallback(topics => { if (topics.some(topic => ['bookings', 'requests'].includes(topic))) void load(); }, [load]));
  const withdraw = async item => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    const result = await dataClient.request(`/client/appointment-requests/${item.kind}/${item.id}/withdraw`, { method: 'POST', body: JSON.stringify({ request_version: Number(item.request_version || 0) }) });
    setBusy(false); setConfirm(null);
    if (result.error) { await load(); setError(result.error.message || 'تعذر إلغاء الطلب. حدّث الصفحة وحاول مجددًا.'); return; }
    setNotice('تم إلغاء الطلب فورًا وإبلاغ الإدارة، ولا يحتاج إلى موافقة.'); await load(); await onChanged?.();
  };
  return <section className="client-pending-requests" aria-label="طلبات المواعيد بانتظار الموافقة"><header><Clock3/><div><h3>طلبات المواعيد بانتظار الموافقة</h3><p>يمكنك إلغاء أي طلب هنا في أي وقت قبل اعتماد الإدارة، حتى لو اقترب الموعد.</p></div></header>{error && <p role="alert" className="request-withdraw-error">{error}</p>}{notice && <p role="status" className="request-withdraw-success">{notice}</p>}{items.map(item => {
    const key = `${item.kind}-${item.id}`; const selected = confirm === key;
    return <article key={key}><div><strong>{labels[item.kind]}</strong><p>{formatBookingDate(item.date)} · {formatTime12(item.start_time)} – {formatTime12(item.end_time)}</p>{item.kind === 'reschedule' && <small>الموعد الأصلي: {formatBookingDate(item.original_date)} · {formatTime12(item.original_start_time)} – {formatTime12(item.original_end_time)}</small>}</div>{selected ? <div className="request-withdraw-confirm"><p>{['reschedule', 'cancellation'].includes(item.kind) ? 'سيتم سحب الطلب فقط، ويظل موعدك الأصلي قائمًا.' : item.kind === 'studio' ? 'سيُلغى طلب هذا الموعد فقط. لا تُلغى الباقة أو المقدم، وتبقى مراجعتهما مع الإدارة.' : 'سيُلغى طلب الحجز مباشرة، وتُتاح الفترة للحجز من جديد.'}</p><button type="button" disabled={busy} onClick={() => withdraw(item)}>{busy ? 'جارٍ الإلغاء…' : 'تأكيد إلغاء الطلب'}</button><button type="button" disabled={busy} onClick={() => setConfirm(null)}>تراجع</button></div> : <button type="button" disabled={busy} onClick={() => { setConfirm(key); setNotice(''); }}><XCircle/> إلغاء الطلب</button>}</article>;
  })}{!items.length && !error && <p className="request-withdraw-empty">لا توجد طلبات مواعيد بانتظار الموافقة.</p>}</section>;
}
