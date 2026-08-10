import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, BanknoteArrowDown, BanknoteArrowUp, CircleDollarSign, Eye, Landmark, Plus, ReceiptText, ShieldCheck, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useChangeSync from '../hooks/useChangeSync';
import ERPPageHero from './ERPPageHero';
import { allocateFormationExpense, toCents } from '../lib/formationFundMath';
import { useData } from '../store/DataContext';
import './ERPFormationFund.css';

const money = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = value => money.format(Number(value || 0));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
const categoryLabels = { studio: 'الاستديو والإيجار', equipment: 'المعدات', furniture: 'الأثاث والتجهيز', licenses: 'التراخيص والتسجيل', legal: 'قانوني', marketing: 'هوية وإطلاق', other: 'مصروفات أخرى' };
const methodOptions = ['تحويل بنكي', 'كاش', 'إنستاباي', 'بطاقة', 'شيك'];

const Dialog = ({ title, description, onClose, children }) => {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const panel = panelRef.current;
    const returnFocus = returnFocusRef.current;
    const background = [...document.querySelectorAll('.erp-sidebar, .erp-mobile-header, .erp-bottom-nav, .formation-page > :not(.formation-dialog-backdrop)')];
    const previous = background.map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
    background.forEach(element => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    const focusable = () => [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null);
    const handleKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable(); if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    focusable()[0]?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous.forEach(({ element, inert, ariaHidden }) => { element.inert = inert; if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden); });
      window.requestAnimationFrame(() => returnFocus?.focus?.());
    };
  }, []);
  return <div className="formation-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="formation-dialog" role="dialog" aria-modal="true" aria-labelledby="formation-dialog-title" ref={panelRef}>
      <header><div><h2 id="formation-dialog-title">{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="formation-icon-button" onClick={onClose} aria-label="إغلاق"><X /></button></header>
      {children}
    </section>
  </div>;
};

const VoidEntryForm = ({ entry, onClose, onVoided }) => {
  const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const submit = async event => { event.preventDefault(); if (reason.trim().length < 3) return setError('اكتب سبب الإبطال بوضوح.'); setSaving(true); setError(''); const { error: requestError } = await dataClient.request(`/formation-fund/entries/${entry.id}/void`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }); setSaving(false); if (requestError) return setError(requestError.message); onVoided(); };
  return <form className="formation-form formation-void-form" onSubmit={submit}>
    <div className="formation-void-summary"><span className={`formation-type formation-type--${entry.entry_type}`}>{entry.entry_type === 'contribution' ? 'مساهمة' : 'مصروف'}</span><div><strong>{entry.title}</strong><small>{entry.entry_date} · {entry.entry_type === 'contribution' ? entry.founder_name : categoryLabels[entry.category] || 'مصروف تأسيس'}</small></div><b>{formatMoney(entry.amount)}</b></div>
    <div className="formation-void-impact"><AlertTriangle /><p>{entry.entry_type === 'expense' ? 'سيُحرّر الإبطال المبلغ الموزع ويعيده إلى أرصدة المؤسسين، مع الاحتفاظ بالقيد في السجل.' : 'لن يُسمح بالإبطال إذا كانت هذه المساهمة مستخدمة بالفعل لتمويل مصروفات قائمة.'}</p></div>
    <label>سبب الإبطال<input autoComplete="off" required minLength="3" maxLength="500" value={reason} onChange={event => setReason(event.target.value)} placeholder="مثال: قيد مكرر أو قيمة غير صحيحة" /></label>
    {error && <p className="formation-form-error" role="alert">{error}</p>}
    <footer><button type="button" className="formation-button formation-button--ghost" onClick={onClose}>رجوع</button><button className="formation-button formation-button--danger" disabled={saving}>{saving ? 'جارٍ الإبطال...' : 'إبطال القيد'}</button></footer>
  </form>;
};

const ContributionForm = ({ founders, selectedFounder, onClose, onSaved }) => {
  const [form, setForm] = useState({ founder_id: selectedFounder || founders[0]?.id || '', amount: '', title: 'زيادة رصيد صندوق التأسيس', entry_date: today(), payment_method: 'تحويل بنكي', reference: '', note: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const submit = async event => { event.preventDefault(); setSaving(true); setError(''); const { error: requestError } = await dataClient.request('/formation-fund/contributions', { method: 'POST', body: JSON.stringify(form) }); setSaving(false); if (requestError) return setError(requestError.message); onSaved(); };
  return <form className="formation-form" onSubmit={submit}>
    <div className="formation-form-grid"><label>المؤسس<select value={form.founder_id} onChange={e => setForm({ ...form, founder_id: Number(e.target.value) })}>{founders.map(founder => <option key={founder.id} value={founder.id}>{founder.name_ar}</option>)}</select></label><label>قيمة المساهمة<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} inputMode="decimal" /></label></div>
    <label>البيان<input required maxLength="180" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
    <div className="formation-form-grid"><label>تاريخ الإيداع<input type="date" required value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></label><label>طريقة الإيداع<select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>{methodOptions.map(option => <option key={option}>{option}</option>)}</select></label></div>
    <label>المرجع<input maxLength="120" placeholder="رقم التحويل أو الإيصال" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></label><label>ملاحظة<textarea rows="3" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
    {error && <p className="formation-form-error" role="alert">{error}</p>}<footer><button type="button" className="formation-button formation-button--ghost" onClick={onClose}>إلغاء</button><button className="formation-button formation-button--teal" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ المساهمة'}</button></footer>
  </form>;
};

const ExpenseForm = ({ founders, pooledAvailable, onClose, onSaved }) => {
  const [form, setForm] = useState({ title: '', category: 'equipment', amount: '', entry_date: today(), payment_method: 'تحويل بنكي', reference: '', note: '', allocation_mode: 'proportional' });
  const [manual, setManual] = useState(Object.fromEntries(founders.map(founder => [founder.id, '']))); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const preview = useMemo(() => form.allocation_mode === 'proportional' ? allocateFormationExpense(form.amount, founders) : founders.map(founder => ({ founder_id: founder.id, amount: Number(manual[founder.id] || 0) })), [form.allocation_mode, form.amount, founders, manual]);
  const manualDifference = toCents(form.amount) - preview.reduce((sum, row) => sum + toCents(row.amount), 0);
  const submit = async event => { event.preventDefault(); if (toCents(form.amount) > toCents(pooledAvailable)) return setError('المصروف يتجاوز الرصيد المجمع المتاح.'); if (form.allocation_mode === 'manual' && manualDifference !== 0) return setError('يجب أن يساوي التوزيع اليدوي قيمة المصروف تمامًا.'); setSaving(true); setError(''); const body = { ...form, allocations: preview }; const { error: requestError } = await dataClient.request('/formation-fund/expenses', { method: 'POST', body: JSON.stringify(body) }); setSaving(false); if (requestError) return setError(requestError.message); onSaved(); };
  return <form className="formation-form" onSubmit={submit}>
    <label>بيان المصروف<input required maxLength="180" placeholder="مثال: دفعة شراء كاميرا وإضاءة" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
    <div className="formation-form-grid"><label>التصنيف<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>قيمة المصروف<input type="number" min="0.01" max={pooledAvailable} step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} inputMode="decimal" /></label></div>
    <div className="formation-form-grid"><label>تاريخ المصروف<input type="date" required value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></label><label>طريقة السداد<select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>{methodOptions.map(option => <option key={option}>{option}</option>)}</select></label></div>
    <fieldset className="formation-allocation"><legend>تحميل المصروف على أرصدة المؤسسين</legend><div className="formation-mode-switch"><button type="button" className={form.allocation_mode === 'proportional' ? 'active' : ''} onClick={() => setForm({ ...form, allocation_mode: 'proportional' })}>نسبي تلقائي</button><button type="button" className={form.allocation_mode === 'manual' ? 'active' : ''} onClick={() => setForm({ ...form, allocation_mode: 'manual' })}>توزيع يدوي</button></div><p className="formation-field-help">المعاينة إرشادية؛ الخادم يعيد الحساب ويعتمد القيم النهائية.</p>
      <div className="formation-allocation-preview">{founders.map(founder => { const row = preview.find(item => Number(item.founder_id) === Number(founder.id)); return <label key={founder.id}><span>{founder.name_ar}<small>متاح {formatMoney(founder.available)}</small></span>{form.allocation_mode === 'manual' ? <input type="number" min="0" max={founder.available} step="0.01" value={manual[founder.id]} onChange={e => setManual({ ...manual, [founder.id]: e.target.value })} aria-label={`حصة ${founder.name_ar}`} /> : <strong>{formatMoney(row?.amount)}</strong>}</label>; })}</div>
      {form.allocation_mode === 'manual' && <p className={manualDifference === 0 ? 'formation-difference is-zero' : 'formation-difference'}>الفرق المتبقي: {formatMoney(manualDifference / 100)}</p>}
    </fieldset>
    <label>المورد / المرجع<input maxLength="120" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></label><label>ملاحظة<textarea rows="3" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
    {error && <p className="formation-form-error" role="alert">{error}</p>}<footer><button type="button" className="formation-button formation-button--ghost" onClick={onClose}>إلغاء</button><button className="formation-button formation-button--amber" disabled={saving}>{saving ? 'جارٍ التسجيل...' : 'تسجيل المصروف'}</button></footer>
  </form>;
};

const CorrectionForm = ({ entry, founders, onClose, onSaved }) => {
  const [form, setForm] = useState({
    founder_id: entry.founder_id || founders[0]?.id || '',
    title: entry.title || '', category: entry.category || (entry.entry_type === 'contribution' ? 'capital' : 'other'),
    amount: entry.amount || '', entry_date: entry.entry_date || today(), payment_method: entry.payment_method || methodOptions[0],
    reference: entry.reference || '', note: entry.note || '', allocation_mode: 'proportional',
    reason: 'تصحيح موثق لحركة صندوق التأسيس',
  });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async event => {
    event.preventDefault();
    if (toCents(form.amount) <= 0) return setError('أدخل قيمة صحيحة أكبر من صفر.');
    if (form.reason.trim().length < 5) return setError('اكتب سبب التصحيح بوضوح.');
    setSaving(true); setError('');
    const { error: requestError } = await dataClient.request(`/formation-fund/entries/${entry.id}/correct`, { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (requestError) return setError(requestError.message);
    onSaved();
  };
  return <form className="formation-form" onSubmit={submit}>
    {entry.entry_type === 'contribution' && <label>المؤسس<select required value={form.founder_id} onChange={event => update('founder_id', Number(event.target.value))}>{founders.map(founder => <option key={founder.id} value={founder.id}>{founder.name_ar}</option>)}</select></label>}
    <label>البيان<input required maxLength="180" value={form.title} onChange={event => update('title', event.target.value)} /></label>
    <div className="formation-form-grid"><label>القيمة<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={event => update('amount', event.target.value)} /></label><label>التاريخ<input required type="date" value={form.entry_date} onChange={event => update('entry_date', event.target.value)} /></label></div>
    {entry.entry_type === 'expense' && <label>التصنيف<select value={form.category} onChange={event => update('category', event.target.value)}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
    <div className="formation-form-grid"><label>طريقة الدفع<select value={form.payment_method} onChange={event => update('payment_method', event.target.value)}>{methodOptions.map(option => <option key={option}>{option}</option>)}</select></label><label>المرجع<input maxLength="120" value={form.reference} onChange={event => update('reference', event.target.value)} /></label></div>
    <label>ملاحظات<textarea rows="3" value={form.note} onChange={event => update('note', event.target.value)} /></label>
    {entry.entry_type === 'expense' && <p className="formation-field-help">سيُعاد توزيع قيمة المصروف المصححة تلقائيًا بنسب الأرصدة المتاحة لحماية اتزان الصندوق.</p>}
    <label>سبب التصحيح<input required minLength="5" maxLength="500" value={form.reason} onChange={event => update('reason', event.target.value)} /></label>
    {error && <p className="formation-form-error" role="alert">{error}</p>}
    <footer><button type="button" className="formation-button formation-button--ghost" onClick={onClose}>رجوع</button><button className="formation-button formation-button--amber" disabled={saving}>{saving ? 'جارٍ حفظ التصحيح...' : 'حفظ قيد التصحيح'}</button></footer>
  </form>;
};

const FormationLedger = ({ entries, founders, currentUser, typeFilter, founderFilter, setTypeFilter, setFounderFilter, onDetails, onEdit, onVoid }) => <section className="formation-ledger">
  <div className="formation-ledger-header"><div className="formation-section-heading compact"><div><span>السجل الدائم</span><h2>حركات صندوق التأسيس</h2></div></div><div className="formation-filters"><label>نوع الحركة<select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">كل الحركات</option><option value="contribution">المساهمات</option><option value="expense">المصروفات</option><option value="voided">الملغاة</option></select></label><label>المؤسس<select value={founderFilter} onChange={event => setFounderFilter(event.target.value)}><option value="all">كل المؤسسين</option>{founders.map(founder => <option key={founder.id} value={founder.id}>{founder.name_ar}</option>)}</select></label></div></div>
  {entries.length ? <><div className="formation-table-wrap"><table><thead><tr><th>التاريخ</th><th>الحركة</th><th>البيان</th><th>الحساب / التوزيع</th><th>القيمة</th><th>الحالة</th><th>بواسطة</th><th>إجراءات</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.id} className={entry.status === 'voided' ? 'is-voided' : ''}><td>{entry.entry_date}</td><td><span className={`formation-type formation-type--${entry.entry_type}`}>{entry.entry_type === 'contribution' ? 'مساهمة' : 'مصروف'}</span></td><td><strong>{entry.title}</strong><small>{categoryLabels[entry.category] || entry.reference || '—'}</small></td><td>{entry.entry_type === 'contribution' ? entry.founder_name : <button className="formation-link-button" onClick={() => onDetails(entry)}><Eye /> عرض توزيع {entry.allocations.length} حسابات</button>}</td><td className={entry.entry_type === 'expense' ? 'amount-expense' : 'amount-contribution'}>{entry.entry_type === 'expense' ? '−' : '+'}{formatMoney(entry.amount)}</td><td><span className={`formation-status formation-status--${entry.status}`}>{entry.status === 'active' ? 'نشط' : 'مُبطل'}</span>{entry.status === 'voided' && <small>{entry.void_reason}</small>}</td><td>{entry.creator_name}</td><td><div className="formation-ledger-card-actions">{entry.status === 'active' && currentUser?.role === 'owner' && <button className="formation-link-button" onClick={() => onEdit(entry)}>تعديل</button>}{entry.status === 'active' && <button className="formation-void-button" onClick={() => onVoid(entry)}>إبطال القيد</button>}</div></td></tr>)}</tbody></table></div>
    <div className="formation-ledger-cards">{entries.map(entry => <article key={entry.id} className={entry.status === 'voided' ? 'is-voided' : ''}><header><div><span className={`formation-type formation-type--${entry.entry_type}`}>{entry.entry_type === 'contribution' ? 'مساهمة' : 'مصروف'}</span><time>{entry.entry_date}</time></div><span className={`formation-status formation-status--${entry.status}`}>{entry.status === 'active' ? 'نشط' : 'مُبطل'}</span></header><div className="formation-ledger-card-main"><div><h3>{entry.title}</h3><small>{entry.entry_type === 'contribution' ? entry.founder_name : categoryLabels[entry.category] || 'مصروف تأسيس'}</small></div><strong className={entry.entry_type === 'expense' ? 'amount-expense' : 'amount-contribution'}>{entry.entry_type === 'expense' ? '−' : '+'}{formatMoney(entry.amount)}</strong></div><div className="formation-ledger-card-actions">{entry.entry_type === 'expense' && <button className="formation-link-button" onClick={() => onDetails(entry)}><Eye /> التوزيع الدقيق</button>}{entry.status === 'active' && currentUser?.role === 'owner' && <button className="formation-link-button" onClick={() => onEdit(entry)}>تعديل بقيد تصحيح</button>}{entry.status === 'active' && <button className="formation-void-button" onClick={() => onVoid(entry)}>إبطال القيد</button>}</div><details><summary>تفاصيل القيد والتدقيق</summary><dl><div><dt>بواسطة</dt><dd>{entry.creator_name}</dd></div><div><dt>المرجع</dt><dd>{entry.reference || '—'}</dd></div>{entry.status === 'voided' && <div><dt>سبب الإبطال</dt><dd>{entry.void_reason}</dd></div>}</dl></details></article>)}</div></> : <div className="formation-empty"><ReceiptText /><strong>لا توجد حركات تطابق الفلاتر.</strong><span>غيّر نوع الحركة أو المؤسس لعرض السجل.</span></div>}
</section>;

const ERPFormationFund = () => {
  const { currentUser } = useData();
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [modal, setModal] = useState(null); const [selectedFounder, setSelectedFounder] = useState(null); const [details, setDetails] = useState(null); const [voidTarget, setVoidTarget] = useState(null); const [editTarget, setEditTarget] = useState(null); const [typeFilter, setTypeFilter] = useState('all'); const [founderFilter, setFounderFilter] = useState('all');
  const fetchData = useCallback(async () => { setLoading(true); const { data: response, error: requestError } = await dataClient.request('/formation-fund', { method: 'GET' }); if (requestError) setError(requestError.message); else { setData(response); setError(''); } setLoading(false); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);
  useChangeSync(useCallback(topics => { if (topics.includes('formation_fund')) fetchData(); }, [fetchData]));
  const closeAndRefresh = () => { setModal(null); fetchData(); };
  const closeVoidAndRefresh = () => { setVoidTarget(null); fetchData(); };
  const filteredEntries = useMemo(() => (data?.entries || []).filter(entry => (typeFilter === 'all' || typeFilter === 'voided' ? typeFilter === 'all' || entry.status === 'voided' : entry.entry_type === typeFilter) && (founderFilter === 'all' || Number(entry.founder_id) === Number(founderFilter) || entry.allocations?.some(row => Number(row.founder_id) === Number(founderFilter)))), [data, typeFilter, founderFilter]);
  const maxCategory = Math.max(1, ...(data?.categories || []).map(item => Number(item.total)));
  if (loading && !data) return <main className="formation-page"><div className="formation-loading" role="status"><Landmark /><span>جارٍ تحميل دفتر صندوق التأسيس...</span></div></main>;
  return <main className="formation-page">
    <ERPPageHero icon={Landmark} eyebrow="رأس مال التأسيس · مستقل عن حسابات التشغيل" title="صندوق التأسيس" description="ثلاثة حسابات مؤسسين دقيقة، ورصيد مجمع واحد لتمويل تأسيس الشركة دون خلطه بالخزينة التشغيلية." actions={<><button data-variant="primary" onClick={() => { setSelectedFounder(null); setModal('contribution'); }}><Plus /> إضافة مساهمة</button><button onClick={() => setModal('expense')}><ReceiptText /> تسجيل مصروف تأسيس</button></>} />
    {error && <div className="formation-alert" role="alert"><AlertTriangle /> <span>{error}</span><button onClick={fetchData}>إعادة المحاولة</button></div>}
    <section className="formation-kpis" aria-label="ملخص صندوق التأسيس"><article className="primary"><span><Landmark /> الرصيد المجمع المتاح</span><strong>{formatMoney(data?.summary.pooled_available)}</strong><small>المتاح الآن للصرف على التأسيس</small></article><article><span><BanknoteArrowUp /> إجمالي المساهمات</span><strong>{formatMoney(data?.summary.total_contributions)}</strong></article><article className="expense"><span><BanknoteArrowDown /> مصروفات التأسيس</span><strong>{formatMoney(data?.summary.total_expenses)}</strong></article><article><span><ReceiptText /> الحركات النشطة</span><strong>{data?.summary.active_transactions || 0}</strong><small>قيد مساهمة أو مصروف</small></article></section>
    <section className="formation-flow" aria-labelledby="founders-title"><div className="formation-section-heading"><div><span>حسابات المؤسسين</span><h2 id="founders-title">أرصدة فردية تصب في صندوق واحد</h2></div><p><ShieldCheck /> الأرصدة حصص محاسبية داخلية وليست نسب ملكية أو أرباح قانونية.</p></div><div className="formation-founder-track"><div className="formation-founder-cards">{data?.founders.map((founder, index) => <article className="formation-founder-card" key={founder.id}><header><span className="formation-avatar">{founder.name_ar.slice(0, 1)}</span><div><h3>{founder.name_ar}</h3><small>حساب مؤسس {String(index + 1).padStart(2, '0')}</small></div></header><dl><div><dt>ساهم</dt><dd>{formatMoney(founder.contributed)}</dd></div><div><dt>حُمّل عليه</dt><dd>{formatMoney(founder.allocated_expenses)}</dd></div></dl><div className="formation-founder-balance"><span>المتاح حاليًا</span><strong>{formatMoney(founder.available)}</strong><small>{data.summary.pooled_available > 0 ? `${((founder.available / data.summary.pooled_available) * 100).toFixed(1)}% من الرصيد المتاح · معلومة فقط` : 'لا توجد نسبة متاحة'}</small></div><button type="button" onClick={() => { setSelectedFounder(founder.id); setModal('contribution'); }}><Plus /> زيادة الرصيد</button></article>)}</div><div className="formation-flow-arrow"><ArrowLeft /><span>يُصرف جماعيًا</span></div><aside className="formation-pool-node"><CircleDollarSign /><span>الصندوق المجمع</span><strong>{formatMoney(data?.summary.pooled_available)}</strong><small>مع تتبع مصدر كل جنيه</small></aside></div></section>
    <div className="formation-lower-grid"><section className="formation-breakdown"><div className="formation-section-heading compact"><div><span>تحليل المصروفات</span><h2>أين صُرف رأس المال؟</h2></div></div>{data?.categories?.length ? <div className="formation-bars">{data.categories.map(item => <div key={item.category}><header><span>{categoryLabels[item.category] || item.category}</span><strong>{formatMoney(item.total)}</strong></header><div><i style={{ width: `${Math.max(3, (Number(item.total) / maxCategory) * 100)}%` }} /></div></div>)}</div> : <div className="formation-empty">لم تُسجل مصروفات تأسيس بعد.</div>}</section><aside className="formation-boundary-note"><ShieldCheck /><h2>حد محاسبي واضح</h2><p>هذا الدفتر لرأس مال ومصروفات تأسيس الشركة فقط. لا يغيّر الملكية القانونية ولا يتصل بفواتير العملاء أو الخزينة التشغيلية.</p></aside></div>
    <FormationLedger entries={filteredEntries} founders={data?.founders || []} currentUser={currentUser} typeFilter={typeFilter} founderFilter={founderFilter} setTypeFilter={setTypeFilter} setFounderFilter={setFounderFilter} onDetails={setDetails} onEdit={setEditTarget} onVoid={setVoidTarget} />
    {modal === 'contribution' && <Dialog title="إضافة مساهمة تأسيس" description="تُضاف إلى حساب المؤسس وتزيد الرصيد المجمع فورًا." onClose={() => setModal(null)}><ContributionForm founders={data.founders} selectedFounder={selectedFounder} onClose={() => setModal(null)} onSaved={closeAndRefresh} /></Dialog>}
    {modal === 'expense' && <Dialog title="تسجيل مصروف تأسيس" description={`الرصيد المجمع المتاح: ${formatMoney(data.summary.pooled_available)}`} onClose={() => setModal(null)}><ExpenseForm founders={data.founders} pooledAvailable={data.summary.pooled_available} onClose={() => setModal(null)} onSaved={closeAndRefresh} /></Dialog>}
    {details && <Dialog title={details.title} description="التوزيع المحاسبي الدقيق للمصروف على أرصدة المؤسسين." onClose={() => setDetails(null)}><div className="formation-details"><div className="formation-details-total"><span>إجمالي المصروف</span><strong>{formatMoney(details.amount)}</strong></div>{details.allocations.map(row => <div key={row.founder_id}><span>{row.founder_name}</span><strong>{formatMoney(row.amount)}</strong></div>)}<button className="formation-button formation-button--ghost" onClick={() => setDetails(null)}>إغلاق</button></div></Dialog>}
    {voidTarget && <Dialog title="إبطال قيد صندوق التأسيس" description="سيظل القيد ظاهرًا في السجل الدائم مع سبب الإبطال والمراجع." onClose={() => setVoidTarget(null)}><VoidEntryForm entry={voidTarget} onClose={() => setVoidTarget(null)} onVoided={closeVoidAndRefresh} /></Dialog>}
    {editTarget && <Dialog title="تصحيح حركة صندوق التأسيس" description="سيُبطل القيد الأصلي ويُنشأ قيد بديل مرتبط به، دون كسر أرصدة المؤسسين أو سجل التدقيق." onClose={() => setEditTarget(null)}><CorrectionForm entry={editTarget} founders={data?.founders || []} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); fetchData(); }} /></Dialog>}
  </main>;
};

export default ERPFormationFund;
