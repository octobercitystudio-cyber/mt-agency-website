import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, Edit3, Filter, PackagePlus, RefreshCw, Search, ShieldAlert, WalletCards, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useData } from '../store/DataContext';
import './ERPPackages.css';

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = { client_id: '', service_id: '', name: '', billing_unit: 'hour', starts_at: today(), quantity: '', validity_days: 90, total_price: '', paid_amount: 0, payment_method: 'cash' };
const initialModal = { open: false, type: '', pkg: null, delta: '', expires_at: '', reason: '' };
const STATUS = { active: ['نشطة', 'active'], expired: ['منتهية', 'expired'], suspended: ['موقوفة', 'suspended'], completed: ['مكتملة', 'completed'] };
const unitLabel = unit => unit === 'reel' ? 'ريل' : 'ساعة';
const money = value => `${Number(value || 0).toLocaleString('ar-EG')} ج`;

export default function ERPPackages() {
  const { currentUser } = useData();
  const role = currentUser?.role;
  const canAssign = ['owner', 'admin', 'operations'].includes(role);
  const canAdjust = ['owner', 'admin'].includes(role);
  const [packages, setPackages] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formBusy, setFormBusy] = useState(false);
  const [modal, setModal] = useState(initialModal);
  const [modalBusy, setModalBusy] = useState(false);
  const addDialogRef = useRef(null);
  const actionDialogRef = useRef(null);
  const dialogTriggerRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    const [packageResult, clientsResult, servicesResult] = await Promise.all([
      supabase.from('client_packages').select('*').order('expires_at', { ascending: true }),
      supabase.from('clients').select('id,name,phone1').order('name', { ascending: true }),
      supabase.from('services').select('*').eq('is_active', 1).order('name', { ascending: true }),
    ]);
    const failed = [packageResult, clientsResult, servicesResult].find(result => result.error);
    if (failed?.error) setError(failed.error.message || 'تعذر تحميل الباقات المباعة.');
    else { setPackages(packageResult.data || []); setClients(clientsResult.data || []); setServices(servicesResult.data || []); }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const closeAddDialog = useCallback(() => setFormOpen(false), []);
  const closeActionDialog = useCallback(() => setModal(initialModal), []);

  useEffect(() => {
    if (!formOpen && !modal.open) return undefined;
    const dialog = formOpen ? addDialogRef.current : actionDialogRef.current;
    const close = formOpen ? closeAddDialog : closeActionDialog;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(dialog?.querySelectorAll(focusableSelector) || []).filter(element => element.offsetParent !== null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => (dialog?.querySelector('[data-dialog-initial]') || focusables()[0])?.focus());
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => dialogTriggerRef.current?.focus());
    };
  }, [formOpen, modal.open, closeActionDialog, closeAddDialog]);

  const client = id => clients.find(item => Number(item.id) === Number(id));
  const available = pkg => Math.max(0, Number(pkg.purchased_quantity) - Number(pkg.held_quantity) - Number(pkg.consumed_quantity));
  const daysToExpiry = pkg => Math.ceil((new Date(`${pkg.expires_at}T12:00`) - new Date()) / 86400000);
  const effectiveStatus = pkg => pkg.status === 'active' && daysToExpiry(pkg) < 0 ? 'expired' : pkg.status;
  const activePackages = packages.filter(pkg => effectiveStatus(pkg) === 'active');
  const expiring = activePackages.filter(pkg => daysToExpiry(pkg) >= 0 && daysToExpiry(pkg) <= 14);
  const remainingHours = activePackages.filter(pkg => pkg.billing_unit !== 'reel').reduce((sum, pkg) => sum + available(pkg), 0);
  const remainingReels = activePackages.filter(pkg => pkg.billing_unit === 'reel').reduce((sum, pkg) => sum + available(pkg), 0);
  const outstanding = packages.reduce((sum, pkg) => sum + Math.max(0, Number(pkg.total_price) - Number(pkg.paid_amount)), 0);

  const filtered = useMemo(() => packages.filter(pkg => {
    const person = clients.find(item => Number(item.id) === Number(pkg.client_id));
    const haystack = `${person?.name || ''} ${person?.phone1 || ''} ${pkg.name}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    const expiryDays = Math.ceil((new Date(`${pkg.expires_at}T12:00`) - new Date()) / 86400000);
    const displayedStatus = pkg.status === 'active' && expiryDays < 0 ? 'expired' : pkg.status;
    if (statusFilter !== 'all' && displayedStatus !== statusFilter) return false;
    if (serviceFilter !== 'all' && String(pkg.service_id) !== serviceFilter) return false;
    const days = expiryDays;
    if (expiryFilter === '14' && !(days >= 0 && days <= 14)) return false;
    if (expiryFilter === 'expired' && days >= 0) return false;
    return true;
  }), [packages, clients, search, statusFilter, serviceFilter, expiryFilter]);

  const selectService = serviceId => {
    const service = services.find(item => String(item.id) === String(serviceId));
    if (!service) return setForm({ ...form, service_id: '' });
    const unit = service.billing_unit || (Number(service.total_reels) > 0 ? 'reel' : 'hour');
    setForm({ ...form, service_id: String(service.id), name: service.name, billing_unit: unit,
      quantity: unit === 'reel' ? Number(service.total_reels || 0) : Number(service.total_hours || 0),
      validity_days: Number(service.validity_days || 90), total_price: Number(service.price || 0) });
  };

  const openAddDialog = event => {
    dialogTriggerRef.current = event.currentTarget;
    setFormOpen(true);
  };

  const openPackageDialog = (type, pkg, event) => {
    dialogTriggerRef.current = event.currentTarget;
    setModal({ ...initialModal, open: true, type, pkg, expires_at: type === 'extend' ? pkg.expires_at : '' });
  };

  const expiryPreview = useMemo(() => { const value = new Date(`${form.starts_at}T12:00`); value.setDate(value.getDate() + Number(form.validity_days || 0)); return Number.isNaN(value.getTime()) ? '—' : value.toISOString().slice(0, 10); }, [form.starts_at, form.validity_days]);

  const submitPackage = async event => {
    event.preventDefault(); setFormBusy(true); setError('');
    if (Number(form.paid_amount) > Number(form.total_price)) {
      setFormBusy(false);
      setError('المبلغ المدفوع لا يمكن أن يكون أكبر من السعر الإجمالي للباقة.');
      return;
    }
    const { error: requestError } = await supabase.request('/client-packages', { method: 'POST', body: JSON.stringify({
      client_id: Number(form.client_id), service_id: Number(form.service_id), name: form.name, billing_unit: form.billing_unit,
      starts_at: form.starts_at, quantity: Number(form.quantity), validity_days: Number(form.validity_days),
      total_price: Number(form.total_price), paid_amount: Number(form.paid_amount), payment_method: form.payment_method,
    }) });
    setFormBusy(false);
    if (requestError) return setError(requestError.message || 'تعذر إضافة الباقة للعميل.');
    setForm(initialForm); setFormOpen(false); setNotice('تمت إضافة الباقة للعميل وتسجيل الدفعة بنجاح.');
    window.setTimeout(() => setNotice(''), 4000); await fetchData();
  };

  const submitModal = async event => {
    event.preventDefault(); setModalBusy(true); setError('');
    const endpoint = modal.type === 'adjust' ? `/client-packages/${modal.pkg.id}/adjust` : `/client-packages/${modal.pkg.id}/extend`;
    const body = modal.type === 'adjust' ? { delta: Number(modal.delta), reason: modal.reason } : { expires_at: modal.expires_at, reason: modal.reason };
    const { error: requestError } = await supabase.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    setModalBusy(false);
    if (requestError) return setError(requestError.message || 'تعذر حفظ التعديل.');
    setModal(initialModal); setNotice(modal.type === 'adjust' ? 'تم تعديل رصيد الباقة وتسجيل السبب.' : 'تم تحديث صلاحية الباقة.');
    window.setTimeout(() => setNotice(''), 4000); await fetchData();
  };

  const updateStatus = async (pkg, status) => {
    const { error: requestError } = await supabase.from('client_packages').update({ status }).eq('id', pkg.id);
    if (requestError) return setError(requestError.message || 'تعذر تغيير حالة الباقة.');
    setPackages(prev => prev.map(item => item.id === pkg.id ? { ...item, status } : item));
    setNotice('تم تحديث حالة الباقة.');
  };

  return <div className="sold-packages" dir="rtl">
    <header className="packages-header"><div><span><WalletCards/> إدارة المبيعات والرصيد</span><h2>الباقات المباعة</h2><p>الرصيد الحقيقي من قاعدة البيانات، مستقل تمامًا عن تجميع الحجوزات.</p></div>{canAssign && <button onClick={openAddDialog}><PackagePlus/> إضافة باقة لعميل</button>}</header>
    <section className="packages-summary"><Metric icon={CheckCircle2} label="الباقات النشطة" value={activePackages.length}/><Metric icon={CalendarClock} label="تنتهي خلال 14 يومًا" value={expiring.length} warning/><Metric icon={Clock3} label="إجمالي الرصيد المتاح" value={`${remainingHours.toLocaleString('ar-EG')} س / ${remainingReels.toLocaleString('ar-EG')} ر`}/><Metric icon={CircleDollarSign} label="قيمة مستحقة" value={money(outstanding)} danger/></section>
    {notice && <div className="packages-notice success" role="status"><CheckCircle2/> {notice}</div>}{error && <div className="packages-notice error" role="alert"><ShieldAlert/><span>{error}</span><button onClick={fetchData}>إعادة المحاولة</button></div>}
    <section className="packages-filters"><label className="packages-search"><Search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم العميل أو الهاتف أو الباقة"/></label><label><Filter/> الحالة<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">كل الحالات</option>{Object.entries(STATUS).map(([key, [label]]) => <option value={key} key={key}>{label}</option>)}</select></label><label>الخدمة<select value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}><option value="all">كل الخدمات</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label>الانتهاء<select value={expiryFilter} onChange={event => setExpiryFilter(event.target.value)}><option value="all">كل التواريخ</option><option value="14">خلال 14 يومًا</option><option value="expired">منتهية التاريخ</option></select></label><button className="packages-refresh" onClick={fetchData}><RefreshCw className={loading ? 'packages-spin' : ''}/></button></section>
    {loading ? <Empty icon={RefreshCw} title="جارٍ تحميل الباقات" text="نسترجع أرصدة الباقات المباعة من الخادم." spin/> : filtered.length ? <><div className="packages-table-wrap"><table><thead><tr><th>العميل والباقة</th><th>الرصيد</th><th>فترة الصلاحية</th><th>الحالة المالية</th><th>الحالة والإجراءات</th></tr></thead><tbody>{filtered.map(pkg => <PackageRow key={pkg.id} pkg={pkg} person={client(pkg.client_id)} canAdjust={canAdjust} available={available(pkg)} status={effectiveStatus(pkg)} onAdjust={event => openPackageDialog('adjust', pkg, event)} onExtend={event => openPackageDialog('extend', pkg, event)} onStatus={status => updateStatus(pkg, status)}/>)}</tbody></table></div><div className="packages-mobile-list">{filtered.map(pkg => <PackageCard key={pkg.id} pkg={pkg} person={client(pkg.client_id)} canAdjust={canAdjust} available={available(pkg)} status={effectiveStatus(pkg)} onAdjust={event => openPackageDialog('adjust', pkg, event)} onExtend={event => openPackageDialog('extend', pkg, event)} onStatus={status => updateStatus(pkg, status)}/>)}</div></> : <Empty icon={Archive} title="لا توجد باقات مطابقة" text="غيّر عوامل البحث أو أضف أول باقة مباعة."/>}

    {formOpen && <div className="packages-modal" onMouseDown={event => {if(event.target===event.currentTarget)closeAddDialog()}}><form ref={addDialogRef} className="packages-dialog large" role="dialog" aria-modal="true" aria-labelledby="add-package-title" aria-describedby="add-package-description" onSubmit={submitPackage}><button type="button" aria-label="إغلاق نافذة إضافة الباقة" className="packages-close" onClick={closeAddDialog}><X/></button><span className="packages-dialog-kicker"><PackagePlus/> عملية بيع جديدة</span><h3 id="add-package-title">إضافة باقة لعميل</h3><p id="add-package-description">اختر العميل وقالب الخدمة، ثم راجع الرصيد والسعر قبل الحفظ.</p><div className="packages-form-grid"><label>العميل<select data-dialog-initial required value={form.client_id} onChange={event => setForm({...form,client_id:event.target.value})}><option value="">اختر العميل</option>{clients.map(item => <option key={item.id} value={item.id}>{item.name} — {item.phone1}</option>)}</select></label><label>قالب الخدمة<select required value={form.service_id} onChange={event => selectService(event.target.value)}><option value="">اختر الخدمة</option>{services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>اسم الباقة<input required value={form.name} onChange={event => setForm({...form,name:event.target.value})}/></label><label>وحدة الرصيد<select value={form.billing_unit} onChange={event => setForm({...form,billing_unit:event.target.value})}><option value="hour">ساعة</option><option value="reel">ريل</option></select></label><label>تاريخ البداية<input required type="date" value={form.starts_at} onChange={event => setForm({...form,starts_at:event.target.value})}/></label><label>مدة الصلاحية بالأيام<input required type="number" min="1" value={form.validity_days} onChange={event => setForm({...form,validity_days:event.target.value})}/></label><label>كمية الباقة<input required type="number" min="0.25" step="0.25" value={form.quantity} onChange={event => setForm({...form,quantity:event.target.value})}/></label><label>السعر الإجمالي<input required type="number" min="0" value={form.total_price} onChange={event => setForm({...form,total_price:event.target.value})}/></label><label>المبلغ المدفوع<input required type="number" min="0" max={form.total_price || undefined} value={form.paid_amount} onChange={event => setForm({...form,paid_amount:event.target.value})}/></label><label>طريقة الدفع<select value={form.payment_method} onChange={event => setForm({...form,payment_method:event.target.value})}><option value="cash">كاش</option><option value="bank_transfer">تحويل بنكي</option><option value="vodafone_cash">فودافون كاش</option><option value="instapay">إنستاباي</option></select></label></div><div className="packages-expiry-preview"><CalendarClock/><span>تاريخ الانتهاء المتوقع</span><strong>{expiryPreview}</strong></div><button className="packages-submit" disabled={formBusy}>{formBusy ? <RefreshCw className="packages-spin"/> : <PackagePlus/>}{formBusy ? 'جارٍ إضافة الباقة...' : 'حفظ الباقة وتسجيل الدفعة'}</button></form></div>}

    {modal.open && <div className="packages-modal" onMouseDown={event => {if(event.target===event.currentTarget)closeActionDialog()}}><form ref={actionDialogRef} className="packages-dialog" role="dialog" aria-modal="true" aria-labelledby="package-action-title" aria-describedby="package-action-description" onSubmit={submitModal}><button type="button" aria-label="إغلاق نافذة تعديل الباقة" className="packages-close" onClick={closeActionDialog}><X/></button><span className="packages-dialog-kicker"><Edit3/> تعديل إداري موثق</span><h3 id="package-action-title">{modal.type === 'adjust' ? 'تعديل رصيد الباقة' : 'تمديد صلاحية الباقة'}</h3><p id="package-action-description">{modal.pkg?.name} — {client(modal.pkg?.client_id)?.name}</p>{modal.type === 'adjust' ? <><label>قيمة التعديل<input data-dialog-initial required type="number" step="0.25" value={modal.delta} onChange={event => setModal({...modal,delta:event.target.value})} placeholder="مثال: 2 أو -1"/></label><div className="packages-adjust-preview"><span>الرصيد المشترى الحالي <b>{Number(modal.pkg?.purchased_quantity||0)}</b></span><span>بعد التعديل <b>{(Number(modal.pkg?.purchased_quantity||0)+Number(modal.delta||0)).toLocaleString('ar-EG')}</b></span><small>لا يمكن أن يقل الإجمالي عن المحجوز والمستهلك.</small></div></> : <label>تاريخ الانتهاء الجديد<input data-dialog-initial required type="date" value={modal.expires_at} onChange={event => setModal({...modal,expires_at:event.target.value})}/></label>}<label>سبب التعديل<textarea required rows="3" value={modal.reason} onChange={event => setModal({...modal,reason:event.target.value})} placeholder="سبب واضح يُحفظ في سجل المراجعة"/></label><button className="packages-submit" disabled={modalBusy || !modal.reason.trim()}>{modalBusy ? <RefreshCw className="packages-spin"/> : <CheckCircle2/>}{modalBusy ? 'جارٍ الحفظ...' : 'تأكيد التعديل'}</button></form></div>}
  </div>;
}

function Metric({icon:Icon,label,value,warning,danger}){return <article className={warning?'warning':danger?'danger':''}><Icon/><div><span>{label}</span><strong>{value}</strong></div></article>}
function StatusBadge({status}){return <span className={`package-status ${STATUS[status]?.[1]||'suspended'}`}>{STATUS[status]?.[0]||status}</span>}
function BalanceBar({pkg,available}){const total=Math.max(1,Number(pkg.purchased_quantity));return <div className="package-balance"><div className="package-balance-labels"><span>متاح <b>{available}</b></span><span>محجوز <b>{Number(pkg.held_quantity)}</b></span><span>مستهلك <b>{Number(pkg.consumed_quantity)}</b></span></div><div className="package-balance-bar"><i className="available" style={{width:`${available/total*100}%`}}/><i className="held" style={{width:`${Number(pkg.held_quantity)/total*100}%`}}/><i className="consumed" style={{width:`${Number(pkg.consumed_quantity)/total*100}%`}}/></div><small>الإجمالي {Number(pkg.purchased_quantity)} {unitLabel(pkg.billing_unit)}</small></div>}
function Actions({pkg,canAdjust,onAdjust,onExtend,onStatus}){return canAdjust?<div className="package-actions"><button onClick={onAdjust}><Edit3/> الرصيد</button><button onClick={onExtend}><CalendarClock/> الصلاحية</button><select aria-label="تغيير حالة الباقة" value={pkg.status} onChange={event=>onStatus(event.target.value)}>{Object.entries(STATUS).filter(([key])=>key!=='expired').map(([key,[label]])=><option key={key} value={key}>{label}</option>)}</select></div>:<small className="packages-readonly">عرض فقط حسب صلاحية الحساب</small>}
function PackageRow({pkg,person,canAdjust,available,status,onAdjust,onExtend,onStatus}){return <tr><td><strong>{person?.name||'عميل'}</strong><span>{person?.phone1}</span><b>{pkg.name}</b></td><td><BalanceBar pkg={pkg} available={available}/></td><td><strong>{pkg.starts_at}</strong><span>حتى {pkg.expires_at}</span></td><td><strong>{money(pkg.paid_amount)}</strong><span>من {money(pkg.total_price)}</span><b className={Number(pkg.total_price)-Number(pkg.paid_amount)>0?'due':''}>متبقي {money(Math.max(0,Number(pkg.total_price)-Number(pkg.paid_amount)))}</b></td><td><StatusBadge status={status}/><Actions pkg={pkg} canAdjust={canAdjust} onAdjust={onAdjust} onExtend={onExtend} onStatus={onStatus}/></td></tr>}
function PackageCard({pkg,person,canAdjust,available,status,onAdjust,onExtend,onStatus}){return <article className="package-mobile-card"><header><div><strong>{person?.name||'عميل'}</strong><span>{pkg.name}</span></div><StatusBadge status={status}/></header><BalanceBar pkg={pkg} available={available}/><dl><div><dt>الصلاحية</dt><dd>{pkg.starts_at} ← {pkg.expires_at}</dd></div><div><dt>المدفوع</dt><dd>{money(pkg.paid_amount)} / {money(pkg.total_price)}</dd></div></dl><Actions pkg={pkg} canAdjust={canAdjust} onAdjust={onAdjust} onExtend={onExtend} onStatus={onStatus}/></article>}
function Empty({icon:Icon,title,text,spin}){return <div className="packages-empty"><Icon className={spin?'packages-spin':''}/><h3>{title}</h3><p>{text}</p></div>}
