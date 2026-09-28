import { staffPath } from '../lib/staffRoutes';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { dataClient } from '../dataClient';
import { safeUiError } from '../lib/uiError';
import { formatEGP, formatDurationMinutes } from '../lib/businessFormat';
import { registrationValidityLabel } from '../lib/registrationPolicy';
import PackageGuideView from '../components/PackageGuideView';
import '../components/PackageGuide.css';

function TextField({ label, value, onChange, multiline = false, maxLength = multiline ? 2000 : 140, required = true }) {
  const props = { value: value || '', onChange: event => onChange(event.target.value), maxLength, required };
  return <label className="package-guide-editor-field"><span>{label}</span>{multiline ? <textarea {...props} rows={3}/> : <input {...props} type="text"/>}</label>;
}

function ObjectRows({ title, rows, fields, onChange, maxRows = 12 }) {
  return <fieldset className="package-guide-editor-list"><legend>{title}</legend>{rows.map((row, index) => <div className="package-guide-editor-row" key={index}>
    <div className="package-guide-editor-row-title"><strong>{title} · {index + 1}</strong><button type="button" className="package-guide-remove" aria-label={`حذف ${title} ${index + 1}`} disabled={rows.length <= 1} onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 aria-hidden="true"/> حذف</button></div>
    {fields.map(([key, label, multiline]) => <TextField key={key} label={label} value={row[key]} multiline={multiline} maxLength={key === 'timeframe' ? 180 : multiline ? 2000 : 140} onChange={value => onChange(rows.map((item, rowIndex) => rowIndex === index ? { ...item, [key]: value } : item))}/>)}
  </div>)}<button type="button" className="package-guide-secondary" disabled={rows.length >= maxRows} onClick={() => onChange([...rows, Object.fromEntries(fields.map(([key]) => [key, '']))])}><Plus aria-hidden="true"/> إضافة بند</button></fieldset>;
}

export default function ERPPackageGuide() {
  const [source, setSource] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState(false);
  const saveLock = useRef(false);
  const dirty = Boolean(draft && source && JSON.stringify(draft) !== JSON.stringify(source.content));
  const load = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const result = await dataClient.request('/package-guide');
      if (result.error || !result.data?.content) throw result.error || new Error('تعذر تحميل الدليل.');
      setSource(result.data); setDraft(structuredClone(result.data.content)); setConflict(false);
    } catch (cause) { setError(safeUiError(cause, 'تعذر تحميل دليل الباقات. أعد المحاولة.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- Load the editable server revision once, never replace an unsaved draft via sync.
  useEffect(() => {
    if (!dirty) return undefined;
    const preventUnload = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty]);
  const patch = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setNotice(''); };
  const reload = () => { if (dirty && !window.confirm('تحميل النسخة الحالية سيستبدل تعديلاتك غير المحفوظة. هل تريد المتابعة؟')) return; void load(); };
  const save = async event => {
    event.preventDefault();
    if (saveLock.current || !draft || conflict) return;
    saveLock.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const result = await dataClient.request('/package-guide', { method: 'PUT', body: JSON.stringify({ expected_revision: source.revision, content: draft }) });
      if (result.error) {
        if (result.error.code === 'guide_revision_conflict' || result.error.status === 409) { setConflict(true); setError('تم تعديل الدليل في جلسة أخرى. تعديلاتك محفوظة هنا للمراجعة؛ حمّل النسخة الحالية قبل إعادة التعديل والحفظ.'); return; }
        throw result.error;
      }
      if (!result.data?.content) throw new Error('تعذر تأكيد حفظ الدليل. أعد تحميل النسخة الحالية للتحقق.');
      setSource(result.data); setDraft(structuredClone(result.data.content)); setConflict(false); setNotice('تم حفظ الدليل. تظهر التعديلات للعملاء عند تحديث الدليل.');
    } catch (cause) { setError(safeUiError(cause, 'تعذر حفظ الدليل. راجع الحقول وحاول مجددًا؛ تعديلاتك لم تُفقد.')); }
    finally { saveLock.current = false; setSaving(false); }
  };
  if (!source || !draft) return <section className="package-guide-editor" dir="rtl"><h1>تعديل دليل الباقات</h1>{loading ? <p role="status">جارٍ تحميل الدليل…</p> : <div role="alert"><p>{error}</p><button className="package-guide-primary" onClick={load}>إعادة المحاولة</button></div>}</section>;
  return <div className="package-guide-editor" dir="rtl">
    <header className="package-guide-editor-header"><div><span><BookOpen aria-hidden="true"/> محتوى يظهر لجميع العملاء</span><h1>تعديل دليل الباقات</h1><p>عدّل النصوص والتجهيزات وطرق الاستلام، وراجع شكلها قبل الحفظ.</p></div><button type="button" className="package-guide-secondary" aria-pressed={preview} onClick={() => setPreview(value => !value)}><Eye aria-hidden="true"/>{preview ? 'العودة للتعديل' : 'معاينة العميل'}</button></header>
    <div className="package-guide-notice"><strong>الأسعار والصلاحيات مرتبطة بالباقات الفعلية.</strong><p><Link to={staffPath('/settings')}>تعديل الأسعار والساعات والصلاحية من الإعدادات</Link> · <Link to={staffPath('/post-production?pickup=1')}>تعديل جدول الاستلام الأسبوعي</Link></p><p>سياسة الحجز والتصوير ثابتة وتظهر في المعاينة للقراءة فقط.</p></div>
    {error && <div className="package-guide-notice package-guide-notice--error" role="alert"><p>{error}</p>{conflict && <button type="button" disabled={loading || saving} onClick={reload}>تحميل النسخة الحالية</button>}</div>}
    {notice && <p className="package-guide-notice package-guide-notice--success" role="status">{notice}</p>}
    {loading && <p role="status">جارٍ تحميل النسخة الحالية…</p>}
    <form onSubmit={save} aria-busy={saving || loading}>
      {preview ? <><p className="package-guide-preview-label">معاينة {dirty ? 'تعديلاتك غير المحفوظة' : 'الدليل المنشور'}</p><PackageGuideView data={{ ...source, content: draft }}/></> : <fieldset className="package-guide-editor-fields" disabled={saving || loading}>
        <section className="package-guide-editor-section"><h2>عنوان الدليل والتعريف بالباقات</h2><TextField label="عنوان الدليل" value={draft.title} onChange={value => patch('title', value)}/><TextField label="نبذة الدليل" multiline maxLength={140} value={draft.subtitle} onChange={value => patch('subtitle', value)}/><TextField label="مقدمة أنظمة التصوير" multiline value={draft.packages_intro} onChange={value => patch('packages_intro', value)}/>{[['hourly_note', 'شرح التصوير بالساعة'], ['daily_note', 'شرح الباقات اليومية'], ['monthly_note', 'شرح الباقات الشهرية']].map(([key, label]) => <TextField key={key} label={label} multiline value={draft[key]} onChange={value => patch(key, value)}/>)}</section>
        <section className="package-guide-editor-section"><h2>ما تشمله جميع الباقات</h2>{draft.included_features.map((feature, index) => <div className="package-guide-editor-feature" key={index}><TextField label={`الميزة ${index + 1}`} maxLength={200} value={feature} onChange={value => patch('included_features', draft.included_features.map((item, itemIndex) => itemIndex === index ? value : item))}/><button type="button" className="package-guide-remove" aria-label={`حذف الميزة ${index + 1}`} disabled={draft.included_features.length <= 1} onClick={() => patch('included_features', draft.included_features.filter((_, itemIndex) => itemIndex !== index))}><Trash2 aria-hidden="true"/></button></div>)}<button type="button" className="package-guide-secondary" disabled={draft.included_features.length >= 12} onClick={() => patch('included_features', [...draft.included_features, ''])}><Plus aria-hidden="true"/> إضافة ميزة</button></section>
        <section className="package-guide-editor-section"><h2>وصف إضافي لكل باقة</h2><p>الأرقام التالية من كتالوج الخدمات الفعلي، ويمكن تغييرها من الإعدادات فقط.</p>{!source.services?.length && <p>لا توجد باقات متاحة في الكتالوج حاليًا.</p>}{(source.services || []).map(service => <div className="package-guide-editor-row" key={service.id}><h3>{service.name}</h3><p className="package-guide-catalog-facts"><bdi>{formatEGP(service.price)}</bdi><span>{formatDurationMinutes(Number(service.total_hours) * 60)}</span><span>{registrationValidityLabel(service)}</span></p><TextField label={`وصف ${service.name} (اختياري)`} multiline maxLength={1500} required={false} value={draft.package_descriptions?.[String(service.id)]} onChange={value => { const descriptions = { ...draft.package_descriptions }; if (value.trim()) descriptions[String(service.id)] = value; else delete descriptions[String(service.id)]; patch('package_descriptions', descriptions); }}/></div>)}</section>
        <section className="package-guide-editor-section"><h2>تجهيزات الاستديو</h2><TextField label="عنوان قسم الاستديو" value={draft.studio_title} onChange={value => patch('studio_title', value)}/><TextField label="نبذة عن الاستديو" multiline value={draft.studio_intro} onChange={value => patch('studio_intro', value)}/><ObjectRows title="تجهيزات الاستديو" rows={draft.studio_features} fields={ [['title', 'اسم التجهيز'], ['description', 'الوصف', true]] } onChange={value => patch('studio_features', value)}/></section>
        <section className="package-guide-editor-section"><h2>طرق ومواعيد التسليم</h2><TextField label="عنوان قسم التسليم" value={draft.delivery_title} onChange={value => patch('delivery_title', value)}/><TextField label="مقدمة التسليم" multiline value={draft.delivery_intro} onChange={value => patch('delivery_intro', value)}/><ObjectRows title="طرق الاستلام" maxRows={8} rows={draft.delivery_options} fields={ [['title', 'طريقة الاستلام'], ['timeframe', 'مدة التسليم'], ['description', 'التفاصيل', true]] } onChange={value => patch('delivery_options', value)}/></section>
        <section className="package-guide-editor-section"><h2>ملاحظة ختامية</h2><TextField label="ملاحظة أسفل الدليل" multiline value={draft.footer_note} onChange={value => patch('footer_note', value)}/></section>
      </fieldset>}
      <footer className="package-guide-editor-actions"><span role="status">{dirty ? 'لديك تعديلات غير محفوظة' : 'تطابق النسخة المحفوظة'}</span><button type="submit" className="package-guide-primary" disabled={saving || loading || !dirty || conflict}><Save aria-hidden="true"/>{saving ? 'جارٍ الحفظ…' : 'حفظ الدليل للعملاء'}</button></footer>
    </form>
  </div>;
}
