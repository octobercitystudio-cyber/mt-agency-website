import { useEffect, useState } from 'react';
import { dataClient } from '../dataClient';

export default function PackageLoyaltyControl({ packageId, onChanged }) {
  const [state, setState] = useState(null), [enabled, setEnabled] = useState(false), [includePaid, setIncludePaid] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; dataClient.request(`/client-packages/${packageId}/loyalty`).then(({ data, error }) => { if (!active) return; if (error) setError(error.message); else { setState(data); setEnabled(Boolean(data.enabled)); setError(''); } }); return () => { active = false; }; }, [packageId, revision]);
  const save = async () => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    const { data, error } = await dataClient.request(`/client-packages/${packageId}/loyalty`, { method: 'POST', body: JSON.stringify({ enabled, include_paid: enabled && includePaid }) });
    setBusy(false); if (error) return setError(error.message);
    setState(data); setIncludePaid(false); setNotice(`تم حفظ الولاء. نقاط هذه الباقة: ${data.awarded_points} نقطة. رصيد العميل: ${data.client_points} نقطة.`); onChanged?.();
  };
  return <section className="owner-editor"><header><h3>نقاط الولاء</h3><p>نقاط على المدفوع المعتمد فقط، حسب معدل الولاء في إعدادات الشركة.</p></header>{error && <p role="alert">{error} <button type="button" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button></p>}{state ? <><label className="package-loyalty-toggle"><input type="checkbox" role="switch" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)}/><span><strong>{enabled ? 'الولاء مفعّل لهذه الباقة' : 'الولاء غير مفعّل لهذه الباقة'}</strong><small>النقاط المحتسبة من الباقة: {state.awarded_points} نقطة</small></span></label>{enabled && <label className="package-loyalty-toggle"><input type="checkbox" checked={includePaid} disabled={busy} onChange={event => setIncludePaid(event.target.checked)}/><span>احتساب المسدّد سابقًا في هذه الباقة أيضًا، دون تكرار النقاط المحتسبة</span></label>}<button type="button" className="owner-save" disabled={busy || (enabled === state.enabled && !includePaid)} onClick={save}>{busy ? 'جارٍ الحفظ…' : 'حفظ إعداد الولاء'}</button></> : !error && <p role="status">جارٍ تحميل إعداد الولاء…</p>}{notice && <p role="status">{notice}</p>}</section>;
}
