import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Archive, Ban, CheckCircle2, LoaderCircle, ShieldAlert, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { ownerActionEvent } from './ownerPermissions';
import './OwnerRecordActions.css';

const actionMeta = {
  hard_delete: { label: 'حذف نهائي', Icon: Trash2, tone: 'danger' },
  archive: { label: 'أرشفة', Icon: Archive, tone: 'archive' },
  deactivate: { label: 'تعطيل', Icon: Ban, tone: 'archive' },
  cancel: { label: 'إلغاء', Icon: Ban, tone: 'danger' },
  void: { label: 'إبطال', Icon: ShieldAlert, tone: 'danger' },
  correct: { label: 'تصحيح', Icon: CheckCircle2, tone: 'primary' },
};

export default function OwnerActionDialog({ entity, record, label, onClose, onChanged, onError, returnFocusRef }) {
  const [impact, setImpact] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    let active = true;
    supabase.request(`/owner/records/${entity}/${record.id}/impact`, { method: 'GET' }).then(({ data, error: requestError }) => {
      if (!active) return;
      if (requestError) setError(requestError.message || 'تعذر فحص الروابط المرتبطة بالسجل.');
      else setImpact(data);
    });
    return () => { active = false; };
  }, [entity, record.id]);

  useEffect(() => {
    const before = document.body.style.overflow;
    const returnFocus = returnFocusRef?.current;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const focusables = () => [...(dialog?.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled])') || [])];
    const keydown = event => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables(); if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    window.requestAnimationFrame(() => dialog?.querySelector('[data-owner-initial]')?.focus());
    return () => { document.body.style.overflow = before; document.removeEventListener('keydown', keydown); window.requestAnimationFrame(() => returnFocus?.focus()); };
  }, [busy, onClose, returnFocusRef]);

  const meta = actionMeta[impact?.action] || actionMeta.archive;
  const linked = Object.entries(impact?.links || {}).filter(([, count]) => Number(count) > 0);
  const canSubmit = impact && reason.trim().length >= 5 && (!impact.requires_confirmation || confirmation.trim() === 'حذف') && !busy;
  const submit = async event => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setError('');
    const { data, error: requestError } = await supabase.request(`/owner/records/${entity}/${record.id}/action`, { method: 'POST', body: JSON.stringify({ reason: reason.trim(), confirmation: confirmation.trim(), expected_action: impact.action, version: record.version ?? null }) });
    if (requestError) { const message=requestError.message || 'تعذر تنفيذ الإجراء.'; setBusy(false); setError(message); onError?.({ id: record.id, entity, message }); return; }
    window.dispatchEvent(new CustomEvent(ownerActionEvent(entity), { detail: data }));
    window.dispatchEvent(new CustomEvent('erpDataChanged', { detail: { entity, id: record.id, action: data.action } }));
    onChanged?.(data);
    onClose();
  };

  return <div className="owner-action-overlay" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
    <section ref={dialogRef} className={`owner-action-dialog owner-action-dialog--${meta.tone}`} role="dialog" aria-modal="true" aria-labelledby="owner-action-title" aria-describedby="owner-action-description">
      <button type="button" className="owner-action-close" onClick={onClose} disabled={busy} aria-label="إغلاق"><X /></button>
      <div className="owner-action-kicker"><ShieldAlert /> صلاحيات المالك · إجراء موثق</div>
      <h2 id="owner-action-title">{impact ? `${meta.label} «${label}»` : 'فحص تأثير الإجراء'}</h2>
      {!impact && !error && <div className="owner-action-loading" aria-live="polite"><LoaderCircle className="spin" /> جارٍ فحص السجل والروابط المرتبطة…</div>}
      {impact && <form onSubmit={submit}>
        <div className="owner-impact-decision"><meta.Icon /><div><strong>{impact.result_title}</strong><p id="owner-action-description">{impact.explanation}</p></div></div>
        <section className="owner-impact-list" aria-label="البيانات المرتبطة">
          <header><span>معاينة التأثير</span><b>{impact.total_links?.toLocaleString('ar-EG') || '٠'} رابط</b></header>
          {linked.length ? <ul>{linked.map(([name, count]) => <li key={name}><span>{impact.link_labels?.[name] || name}</span><strong>{Number(count).toLocaleString('ar-EG')}</strong></li>)}</ul> : <p>لا توجد بيانات تجارية أو مالية مرتبطة بهذا السجل.</p>}
        </section>
        <label className="owner-reason">سبب الإجراء <span>مطلوب للتدقيق</span><textarea data-owner-initial required minLength="5" maxLength="500" rows="3" value={reason} onChange={event => setReason(event.target.value)} placeholder="اكتب سببًا واضحًا يمكن الرجوع إليه لاحقًا" /></label>
        {impact.requires_confirmation && <label className="owner-confirmation"><AlertTriangle /> للتأكيد النهائي اكتب كلمة «حذف»<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /></label>}
        {error && <p className="owner-action-error" role="alert"><AlertTriangle /> {error}</p>}
        <footer><button type="button" className="secondary" onClick={onClose} disabled={busy}>رجوع</button><button type="submit" className={meta.tone} disabled={!canSubmit}>{busy ? <><LoaderCircle className="spin" /> جارٍ التنفيذ…</> : <><meta.Icon /> تأكيد {meta.label}</>}</button></footer>
      </form>}
      {!impact && error && <><p className="owner-action-error" role="alert"><AlertTriangle /> {error}</p><button type="button" className="owner-action-retry" onClick={onClose}>إغلاق</button></>}
    </section>
  </div>;
}
