import { useCallback, useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { emptyClient } from './clientForm';
import ClientCredentialSecurity from './ClientCredentialSecurity';
import { clientModalAppearance } from './clientModalAppearance';
import { resolveClientModalSaveResult } from './clientModalFlow';
import './ERPClientModal.css';

const fieldStyle = { width: '100%', padding: '12px', borderRadius: '.5rem', border: 'none', background: 'var(--erp-bg)' };
const labelStyle = { fontSize: '.8rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' };

export default function ERPClientModal({ isOpen, onClose, onSuccess, client = emptyClient, canManageAccess = false, returnFocusRef, nested = false, appearance = 'default' }) {
  const isEditing = Boolean(client?.id);
  const appearanceContract = clientModalAppearance(appearance);
  const [draft, setDraft] = useState(() => ({ ...emptyClient, ...client }));
  const [saveState, setSaveState] = useState({ busy: false, type: '', message: '' });
  const close = useCallback(() => { if (!saveState.busy) onClose(); }, [onClose, saveState.busy]);
  const dialogRef = useModalDialog(isOpen, close, { returnFocusRef });

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      setDraft({ ...emptyClient, ...client, email: client?.email || '' });
      setSaveState({ busy: false, type: '', message: '' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [client, isOpen]);

  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const save = async event => {
    event.preventDefault();
    setSaveState({ busy: true, type: '', message: '' });
    const payload = {
      name: draft.name, phone1: draft.phone1, phone2: draft.phone2 || null, email: draft.email || null,
      company_name: draft.company_name || null, contact_person: draft.contact_person || null, job: draft.job || null,
      address: draft.address || null, city: draft.city || null, tax_number: draft.tax_number || null,
      commercial_registration: draft.commercial_registration || null, preferred_contact: draft.preferred_contact,
      whatsapp_opt_in: draft.whatsapp_opt_in ? 1 : 0, notes: draft.notes || null, color: draft.color,
    };
    const result = isEditing
      ? await dataClient.from('clients').update(payload).eq('id', draft.id)
      : await dataClient.request('/clients', { method: 'POST', body: JSON.stringify(payload) });
    const outcome = resolveClientModalSaveResult({ result, isEditing, draft, payload });
    if (!outcome.ok) {
      setSaveState({ busy: false, type: 'error', message: outcome.message });
      return;
    }
    const savedClient = outcome.savedClient;
    setSaveState({ busy: false, type: 'success', message: isEditing ? 'تم تحديث بيانات العميل بنجاح.' : 'تم إنشاء العميل وبيانات دخوله بأمان.' });
    window.dispatchEvent(new CustomEvent('erpClientsUpdated'));
    await onSuccess?.(savedClient);
    onClose();
  };

  if (!isOpen) return null;
  return <div className={`erp-modal-overlay${nested ? ' erp-client-modal-overlay--nested' : ''}${appearanceContract.overlayClass ? ` ${appearanceContract.overlayClass}` : ''}`} data-appearance={appearanceContract.name} style={appearanceContract.tokens} onMouseDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}>
    <div ref={dialogRef} className={`erp-modal-content erp-client-modal-content${appearanceContract.contentClass ? ` ${appearanceContract.contentClass}` : ''}`} role="dialog" aria-modal="true" aria-labelledby="client-modal-title" style={{ maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '1.5rem', padding: '30px', border: 'none', boxShadow: '0 1rem 3rem rgba(0,0,0,.175)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <h2 id="client-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: 'var(--erp-text-main)', fontSize: '1.1rem', fontWeight: 'bold' }}><UserPlus color="#ffc107" /> {isEditing ? 'تعديل بيانات العميل' : 'تسجيل عميل جديد'}</h2>
        <button type="button" className="erp-client-modal-close" onClick={close} aria-label="إغلاق نموذج العميل"><X /></button>
      </div>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div><label style={labelStyle}>الاسم بالكامل</label><input autoFocus style={{ ...fieldStyle, fontWeight: 'bold' }} value={draft.name} onChange={e => update('name', e.target.value)} required /></div>
        <div className="erp-client-modal-grid"><div><label style={labelStyle}>اسم الشركة / العلامة</label><input value={draft.company_name || ''} onChange={e => update('company_name', e.target.value)} style={fieldStyle}/></div><div><label style={labelStyle}>شخص التواصل</label><input value={draft.contact_person || ''} onChange={e => update('contact_person', e.target.value)} style={fieldStyle}/></div></div>
        <div className="erp-client-modal-grid"><div><label style={labelStyle}>واتساب (أساسي)</label><input style={{ ...fieldStyle, background: 'rgba(25,135,84,.15)', color: '#198754', fontWeight: 'bold' }} value={draft.phone1} onChange={e => update('phone1', e.target.value)} required /></div><div><label style={labelStyle}>رقم ثانٍ (اختياري)</label><input style={fieldStyle} value={draft.phone2 || ''} onChange={e => update('phone2', e.target.value)} /></div></div>
        <div><label style={labelStyle}>البريد الإلكتروني (اختياري)</label><input type="email" dir="ltr" style={fieldStyle} value={draft.email || ''} onChange={e => update('email', e.target.value)} placeholder="client@example.com" /></div>
        <div className="erp-client-modal-grid erp-client-modal-grid--wide"><div><label style={labelStyle}>العنوان</label><input value={draft.address || ''} onChange={e => update('address', e.target.value)} style={fieldStyle}/></div><div><label style={labelStyle}>المدينة</label><input value={draft.city || ''} onChange={e => update('city', e.target.value)} style={fieldStyle}/></div></div>
        <div className="erp-client-modal-grid"><div><label style={labelStyle}>الرقم الضريبي</label><input value={draft.tax_number || ''} onChange={e => update('tax_number', e.target.value)} style={fieldStyle}/></div><div><label style={labelStyle}>السجل التجاري</label><input value={draft.commercial_registration || ''} onChange={e => update('commercial_registration', e.target.value)} style={fieldStyle}/></div></div>
        <div className="erp-client-modal-grid erp-client-modal-grid--wide"><div><label style={labelStyle}>الوظيفة / ملاحظة</label><input style={fieldStyle} value={draft.job || ''} onChange={e => update('job', e.target.value)} /></div><div><label style={labelStyle}>اللون</label><input type="color" style={{ ...fieldStyle, padding: '5px', height: '45px' }} value={draft.color} onChange={e => update('color', e.target.value)} /></div></div>
        <div className="erp-client-modal-grid"><div><label style={labelStyle}>وسيلة التواصل المفضلة</label><select value={draft.preferred_contact || 'whatsapp'} onChange={e => update('preferred_contact', e.target.value)} style={fieldStyle}><option value="whatsapp">واتساب</option><option value="phone">مكالمة</option><option value="email">بريد إلكتروني</option></select></div><label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '.5rem', background: 'rgba(25,135,84,.08)', fontSize: '.78rem', fontWeight: 700 }}><input type="checkbox" checked={Boolean(Number(draft.whatsapp_opt_in ?? 1))} onChange={e => update('whatsapp_opt_in', e.target.checked ? 1 : 0)}/>موافق على إشعارات واتساب</label></div>
        <div><label style={labelStyle}>ملاحظات العميل</label><textarea rows="2" value={draft.notes || ''} onChange={e => update('notes', e.target.value)} style={{ ...fieldStyle, resize: 'vertical' }}/></div>
        {!isEditing && <p className="erp-client-modal-security-note">بعد حفظ العميل، افتح بياناته واستخدم قسم «الدخول والأمان» لإنشاء بيانات دخول مؤقتة وآمنة.</p>}
        {isEditing && canManageAccess && <ClientCredentialSecurity clientId={draft.id} />}
        {saveState.message && <div className={`erp-client-modal-message ${saveState.type}`} role={saveState.type === 'error' ? 'alert' : 'status'} style={{ padding: '11px 13px', borderRadius: '9px', fontSize: '.76rem', background: saveState.type === 'error' ? 'rgba(220,53,69,.1)' : 'rgba(25,135,84,.1)', color: saveState.type === 'error' ? '#dc3545' : '#198754' }}>{saveState.message}</div>}
        <button type="submit" className="erp-client-modal-submit" disabled={saveState.busy} style={{ width: '100%', padding: '15px', borderRadius: '1rem', border: 'none', background: isEditing ? 'var(--erp-text-main)' : '#0d6efd', color: 'var(--erp-surface)', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '15px', opacity: saveState.busy ? .6 : 1 }}>{saveState.busy ? 'جارٍ الحفظ...' : isEditing ? 'تحديث البيانات' : 'حفظ العميل'}</button>
      </form>
    </div>
  </div>;
}
