import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { emptyClient } from './clientForm';
import { clientAdditionalPhones, clientPhoneFields, MAX_ADDITIONAL_CLIENT_PHONES } from '../lib/clientPhones';
import ClientCredentialSecurity from './ClientCredentialSecurity';
import { clientModalAppearance } from './clientModalAppearance';
import { resolveClientModalSaveResult } from './clientModalFlow';
import './ERPClientModal.css';

const fieldStyle = { width: '100%', padding: '12px', borderRadius: '.5rem', border: 'none', background: 'var(--erp-bg)' };
const labelStyle = { fontSize: '.8rem', fontWeight: 'bold', color: 'var(--erp-text-muted)', marginBottom: '5px', display: 'block' };

export default function ERPClientModal({ isOpen, onClose, onSuccess, client = emptyClient, canManageAccess = false, returnFocusRef, nested = false, appearance = 'default' }) {
  const isEditing = Boolean(client?.id);
  const fieldId = useId();
  const appearanceContract = clientModalAppearance(appearance);
  const [draft, setDraft] = useState(() => ({ ...emptyClient, ...client, additional_phones: clientAdditionalPhones(client) }));
  const [saveState, setSaveState] = useState({ busy: false, type: '', message: '' });
  const [colorMode, setColorMode] = useState(client?.id ? 'manual' : 'auto');
  const colorEditedRef = useRef(Boolean(client?.id));
  const close = useCallback(() => { if (!saveState.busy) onClose(); }, [onClose, saveState.busy]);
  const dialogRef = useModalDialog(isOpen, close, { returnFocusRef });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const editing = Boolean(client?.id);
      colorEditedRef.current = editing;
      setColorMode(editing ? 'manual' : 'auto');
      setDraft({ ...emptyClient, ...client, additional_phones: clientAdditionalPhones(client) });
      setSaveState({ busy: false, type: '', message: '' });
      if (!editing) {
        const result = await dataClient.request('/clients/next-color', { method: 'GET' });
        const suggestedColor = result?.data?.color;
        if (!cancelled && !colorEditedRef.current && /^#[0-9a-f]{6}$/i.test(suggestedColor || '')) {
          setDraft(current => ({ ...current, color: suggestedColor }));
        }
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [client, isOpen]);

  const update = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const save = async event => {
    event.preventDefault();
    let phones;
    try { phones = clientPhoneFields(draft); }
    catch (error) { setSaveState({ busy: false, type: 'error', message: error.message }); return; }
    setSaveState({ busy: true, type: '', message: '' });
    const payload = {
      name: draft.name.trim(), ...phones,
      company_name: String(draft.company_name || '').trim() || null, job: String(draft.job || '').trim() || null,
      color: isEditing || colorEditedRef.current ? draft.color : null,
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
    setSaveState({ busy: false, type: 'success', message: isEditing ? 'تم تحديث بيانات العميل بنجاح.' : 'تم تسجيل العميل بنجاح.' });
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
        <div><label htmlFor={`${fieldId}-name`} style={labelStyle}>اسم العميل</label><input id={`${fieldId}-name`} autoFocus autoComplete="name" style={{ ...fieldStyle, fontWeight: 'bold' }} value={draft.name || ''} onChange={e => update('name', e.target.value)} required /></div>
        <div>
          <label htmlFor={`${fieldId}-phone`} style={labelStyle}>رقم الموبايل واتساب (أساسي)</label>
          <div className="erp-client-phone-row"><input id={`${fieldId}-phone`} type="tel" dir="ltr" autoComplete="tel" style={{ ...fieldStyle, background: 'rgba(25,135,84,.1)', fontWeight: 'bold' }} value={draft.phone1 || ''} onChange={e => update('phone1', e.target.value)} required /><button type="button" className="erp-client-phone-add" aria-label="إضافة رقم موبايل آخر" title="إضافة رقم آخر" disabled={draft.additional_phones.length >= MAX_ADDITIONAL_CLIENT_PHONES} onClick={() => update('additional_phones', [...draft.additional_phones, ''])}><Plus size={20}/><span>رقم آخر</span></button></div>
        </div>
        {draft.additional_phones.map((phone, index) => <div key={index}><label htmlFor={`${fieldId}-phone-${index}`} style={labelStyle}>رقم موبايل إضافي {index + 1}</label><div className="erp-client-phone-row"><input id={`${fieldId}-phone-${index}`} type="tel" dir="ltr" aria-label={`رقم موبايل إضافي ${index + 1}`} autoComplete="off" style={fieldStyle} value={phone} onChange={event => update('additional_phones', draft.additional_phones.map((value, position) => position === index ? event.target.value : value))}/><button type="button" className="erp-client-phone-remove" aria-label={`حذف الرقم الإضافي ${index + 1}`} onClick={() => update('additional_phones', draft.additional_phones.filter((_, position) => position !== index))}><X size={18}/></button></div></div>)}
        <div className="erp-client-modal-grid"><div><label htmlFor={`${fieldId}-job`} style={labelStyle}>الوظيفة</label><input id={`${fieldId}-job`} autoComplete="organization-title" value={draft.job || ''} onChange={e => update('job', e.target.value)} style={fieldStyle}/></div><div><label htmlFor={`${fieldId}-company`} style={labelStyle}>الشركة</label><input id={`${fieldId}-company`} autoComplete="organization" value={draft.company_name || ''} onChange={e => update('company_name', e.target.value)} style={fieldStyle}/></div></div>
        <div><label htmlFor={`${fieldId}-color`} style={labelStyle}>لون العميل</label><input id={`${fieldId}-color`} type="color" aria-describedby={`${fieldId}-color-note`} style={{ ...fieldStyle, padding: '5px', height: '45px' }} value={draft.color} onChange={e => { colorEditedRef.current = true; setColorMode('manual'); update('color', e.target.value); }} /><small id={`${fieldId}-color-note`} className={`erp-client-color-note${colorMode === 'auto' ? ' is-auto' : ''}`}>{colorMode === 'auto' ? 'لون مختلف يُختار تلقائيًا عند الحفظ.' : 'لون مخصص تم اختياره يدويًا.'}</small></div>
        {saveState.message && <div className={`erp-client-modal-message ${saveState.type}`} role={saveState.type === 'error' ? 'alert' : 'status'} style={{ padding: '11px 13px', borderRadius: '9px', fontSize: '.76rem', background: saveState.type === 'error' ? 'rgba(220,53,69,.1)' : 'rgba(25,135,84,.1)', color: saveState.type === 'error' ? '#dc3545' : '#198754' }}>{saveState.message}</div>}
        <button type="submit" className="erp-client-modal-submit" disabled={saveState.busy} style={{ width: '100%', padding: '15px', borderRadius: '1rem', border: 'none', background: isEditing ? 'var(--erp-text-main)' : '#0d6efd', color: 'var(--erp-surface)', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '15px', opacity: saveState.busy ? .6 : 1 }}>{saveState.busy ? 'جارٍ الحفظ...' : isEditing ? 'تحديث البيانات' : 'حفظ العميل'}</button>
      </form>
      {isEditing && canManageAccess && <ClientCredentialSecurity clientId={draft.id} />}
    </div>
  </div>;
}
