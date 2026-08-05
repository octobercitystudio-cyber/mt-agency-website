import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CalendarCheck2, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, Edit3, Eye, Filter, History, MoreVertical, PackageCheck, PackagePlus, ReceiptText, RefreshCw, Search, ShieldAlert, TimerReset, Trash2, WalletCards, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useData } from '../store/DataContext';
import './ERPPackages.css';
import { safeUiError } from '../lib/uiError';
import { cairoDateKey, centsToMoney, effectivePackageStatus, formatBookingDate, formatDateTime12, formatEGP, formatPackageQuantity, formatTime12, packageFinancialSummary, packageQuantitySummary, remainingBusinessDays } from '../lib/businessFormat';
import ERPPageHero from './ERPPageHero';
import { isStudioPackageService } from '../lib/serviceCatalog';
import useChangeSync from '../hooks/useChangeSync';

const today = () => cairoDateKey();
const initialForm = { client_id: '', service_id: '', name: '', billing_unit: 'hour', starts_at: today(), quantity: '', validity_days: 90, total_price: '', paid_amount: 0, payment_method: 'cash' };
const initialModal = { open: false, type: 'details', pkg: null, name: '', notes: '', starts_at: '', expires_at: '', status: 'active', target_quantity: '', target_total_price: '', target_paid_amount: '', payment_method: 'cash', reason: '', destructiveConfirmed: false, deleteConfirmation: '', audit: [], auditLoading: false };
const STATUS = { active: ['نشطة', 'active'], expired: ['منتهية', 'expired'], suspended: ['موقوفة', 'suspended'], completed: ['مكتملة', 'completed'] };
const money = formatEGP;
const PAYMENT_METHODS = { cash: 'كاش', bank_transfer: 'تحويل بنكي', vodafone_cash: 'فودافون كاش', instapay: 'إنستاباي' };
const BOOKING_STATUS = { pending: 'بانتظار التأكيد', confirmed: 'مؤكد', alternative_proposed: 'موعد بديل', cancel_requested: 'إلغاء قيد المراجعة', late_cancel_requested: 'إلغاء متأخر', in_progress: 'جارٍ الآن', completed: 'مكتمل' };
const packageCanHardDelete = pkg => pkg?.status === 'draft' && !pkg?.source_invoice_id && Number(pkg?.consumed_quantity || 0) === 0 && Number(pkg?.held_quantity || 0) === 0 && Number(pkg?.paid_amount || 0) === 0;

export default function ERPPackages() {
  const { currentUser } = useData();
  const role = currentUser?.role;
  const canAssign = ['owner', 'admin', 'operations'].includes(role);
  const canAdjust = role === 'owner';
  const canViewDetails = ['owner', 'admin'].includes(role);
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
  const [details, setDetails] = useState({ open: false, pkg: null, data: null, loading: false, error: '', tab: 'payments' });
  const addDialogRef = useRef(null);
  const actionDialogRef = useRef(null);
  const detailsDialogRef = useRef(null);
  const dialogTriggerRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    const [packageResult, clientsResult, servicesResult] = await Promise.all([
      supabase.from('client_packages').select('*').order('expires_at', { ascending: true }),
      supabase.from('clients').select('id,name,phone1').order('name', { ascending: true }),
      supabase.from('services').select('*').eq('is_active', 1).order('name', { ascending: true }),
    ]);
    const failed = [packageResult, clientsResult, servicesResult].find(result => result.error);
    if (failed?.error) setError(safeUiError(failed.error, 'تعذر تحميل الباقات المباعة الآن.'));
    else {
      const studioServices = (servicesResult.data || []).filter(isStudioPackageService);
      const studioServiceIds = new Set(studioServices.map(service => Number(service.id)));
      setPackages((packageResult.data || []).filter(pkg => studioServiceIds.has(Number(pkg.service_id))));
      setClients(clientsResult.data || []);
      setServices(studioServices);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const closeAddDialog = useCallback(() => setFormOpen(false), []);
  const closeActionDialog = useCallback(() => setModal(initialModal), []);
  const closeDetailsDialog = useCallback(() => setDetails(current => ({ ...current, open: false })), []);

  const fetchDetails = useCallback(async packageId => {
    setDetails(current => ({ ...current, loading: true, error: '' }));
    const { data, error: requestError } = await supabase.request(`/client-packages/${packageId}/details`, { method: 'GET' });
    setDetails(current => current.pkg?.id === packageId ? { ...current, data: requestError ? null : data, loading: false, error: requestError ? safeUiError(requestError, 'تعذر تحميل كشف الباقة.') : '' } : current);
  }, []);

  const openDetailsDialog = (pkg, event) => {
    dialogTriggerRef.current = event.currentTarget;
    setDetails({ open: true, pkg, data: null, loading: true, error: '', tab: 'payments' });
    fetchDetails(pkg.id);
  };

  const openDetailPackageId = details.open ? details.pkg?.id : null;
  useChangeSync(useCallback(topics => {
    if (!topics.some(topic => ['client_packages', 'bookings', 'finance'].includes(topic))) return;
    fetchData();
    if (openDetailPackageId) fetchDetails(openDetailPackageId);
  }, [openDetailPackageId, fetchData, fetchDetails]));

  useEffect(() => {
    if (!formOpen && !modal.open && !details.open) return undefined;
    const dialog = formOpen ? addDialogRef.current : modal.open ? actionDialogRef.current : detailsDialogRef.current;
    const close = formOpen ? closeAddDialog : modal.open ? closeActionDialog : closeDetailsDialog;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(dialog?.querySelectorAll(focusableSelector) || []).filter(element => element.offsetParent !== null);
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.querySelectorAll('.erp-sidebar,.erp-mobile-header,.erp-bottom-nav,.sold-packages > :not(.packages-modal)'));
    const previousA11y = background.map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
    background.forEach(element => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    // eslint-disable-next-line react-hooks/immutability
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
      previousA11y.forEach(({ element, inert, ariaHidden }) => { element.inert = inert; if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden); });
      window.requestAnimationFrame(() => dialogTriggerRef.current?.focus());
    };
  }, [formOpen, modal.open, details.open, closeActionDialog, closeAddDialog, closeDetailsDialog]);

  const client = id => clients.find(item => Number(item.id) === Number(id));
  const available = pkg => packageQuantitySummary(pkg).available;
  const daysToExpiry = pkg => remainingBusinessDays(pkg.expires_at);
  const effectiveStatus = pkg => effectivePackageStatus(pkg);
  const activePackages = packages.filter(pkg => effectiveStatus(pkg) === 'active');
  const expiring = activePackages.filter(pkg => daysToExpiry(pkg) >= 0 && daysToExpiry(pkg) <= 14);
  const remainingHours = activePackages.filter(pkg => pkg.billing_unit !== 'reel').reduce((sum, pkg) => sum + available(pkg), 0);
  const remainingReels = activePackages.filter(pkg => pkg.billing_unit === 'reel').reduce((sum, pkg) => sum + available(pkg), 0);
  const outstandingCents = packages.reduce((sum, pkg) => sum + packageFinancialSummary(pkg).outstandingCents, 0);

  const filtered = useMemo(() => packages.filter(pkg => {
    const person = clients.find(item => Number(item.id) === Number(pkg.client_id));
    const haystack = `${person?.name || ''} ${person?.phone1 || ''} ${pkg.name}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    const expiryDays = daysToExpiry(pkg);
    const displayedStatus = effectiveStatus(pkg);
    if (statusFilter !== 'all' && displayedStatus !== statusFilter) return false;
    if (serviceFilter !== 'all' && String(pkg.service_id) !== serviceFilter) return false;
    const days = expiryDays;
    if (expiryFilter === '14' && !(displayedStatus === 'active' && days >= 0 && days <= 14)) return false;
    if (expiryFilter === 'expired' && displayedStatus !== 'expired') return false;
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

  const openPackageDialog = async (type, pkg, event) => {
    dialogTriggerRef.current = event.currentTarget;
    setModal({ ...initialModal, open: true, type, pkg, name: pkg.name || '', notes: pkg.notes || '', starts_at: String(pkg.starts_at || '').slice(0, 10), expires_at: String(pkg.expires_at || '').slice(0, 10), status: pkg.status || 'active', target_quantity: Number(pkg.purchased_quantity || 0), target_total_price: Number(pkg.total_price || 0), target_paid_amount: Number(pkg.paid_amount || 0), auditLoading: true });
    const { data } = await supabase.request(`/audit-logs?entity_type=client_packages&entity_id=${pkg.id}`, { method: 'GET' });
    setModal(current => current.open && Number(current.pkg?.id) === Number(pkg.id) ? { ...current, audit: data || [], auditLoading: false } : current);
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
    if (requestError) return setError(safeUiError(requestError, 'تعذر إضافة الباقة للعميل.'));
    setForm(initialForm); setFormOpen(false); setNotice('تمت إضافة الباقة للعميل وتسجيل الدفعة بنجاح.');
    window.setTimeout(() => setNotice(''), 4000); await fetchData();
  };

  const submitModal = async event => {
    event.preventDefault(); setModalBusy(true); setError('');
    const endpoint = modal.type === 'hours' ? `/client-packages/${modal.pkg.id}/adjust` : modal.type === 'commercial' ? `/client-packages/${modal.pkg.id}/commercial-adjustment` : modal.type === 'archive' ? `/client-packages/${modal.pkg.id}/archive` : `/client-packages/${modal.pkg.id}`;
    const body = modal.type === 'hours' ? { target_quantity: Number(modal.target_quantity), reason: modal.reason } : modal.type === 'commercial' ? { target_total_price: modal.target_total_price, target_paid_amount: modal.target_paid_amount, method: modal.payment_method, reason: modal.reason } : modal.type === 'archive' ? { reason: modal.reason, hard_delete: packageCanHardDelete(modal.pkg), confirmation: modal.deleteConfirmation } : { name: modal.name, notes: modal.notes, starts_at: modal.starts_at, expires_at: modal.expires_at, status: modal.status, reason: modal.reason };
    if (modal.type === 'details') {
      const result = await supabase.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
      setModalBusy(false);
      if (result.error) return setError(safeUiError(result.error, 'تعذر حفظ تعديل الباقة.'));
      setModal(initialModal); setNotice('تم تحديث بيانات الباقة وتسجيل السبب في سجل المراجعة.'); await fetchData(); return;
    }
    const { error: requestError } = await supabase.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    setModalBusy(false);
    if (requestError) return setError(safeUiError(requestError, 'تعذر حفظ التعديل.'));
    setModal(initialModal); setNotice(modal.type === 'archive' ? 'تم تطبيق الإجراء الآمن مع الاحتفاظ بالسجل المرتبط.' : 'تم حفظ التصحيح وإنشاء أثر مراجعة قابل للتتبع.');
    window.setTimeout(() => setNotice(''), 4000); await fetchData();
  };

  return <div className="sold-packages" dir="rtl">
    <ERPPageHero icon={WalletCards} eyebrow="إدارة المبيعات والرصيد" title="الباقات المباعة" description="الرصيد الحقيقي من قاعدة البيانات، مستقل تمامًا عن تجميع الحجوزات." actions={canAssign && <button data-variant="primary" onClick={openAddDialog}><PackagePlus/> إضافة باقة لعميل</button>}/>
    <section className="packages-summary"><Metric icon={CheckCircle2} label="الباقات النشطة" value={activePackages.length}/><Metric icon={CalendarClock} label="تنتهي خلال 14 يوم عمل" value={expiring.length} warning/><Metric icon={Clock3} label="متاح لحجز جديد" value={`${remainingHours.toLocaleString('ar-EG')} س / ${remainingReels.toLocaleString('ar-EG')} ر`}/><Metric icon={CircleDollarSign} label="قيمة مستحقة" value={money(centsToMoney(outstandingCents))} danger/></section>
    {notice && <div className="packages-notice success" role="status"><CheckCircle2/> {notice}</div>}{error && <div className="packages-notice error" role="alert"><ShieldAlert/><span>{error}</span><button onClick={fetchData}>إعادة المحاولة</button></div>}
    <section className="packages-filters"><label className="packages-search"><Search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم العميل أو الهاتف أو الباقة"/></label><label><Filter/> الحالة<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">كل الحالات</option>{Object.entries(STATUS).map(([key, [label]]) => <option value={key} key={key}>{label}</option>)}</select></label><label>الخدمة<select value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}><option value="all">كل الخدمات</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label>الانتهاء<select value={expiryFilter} onChange={event => setExpiryFilter(event.target.value)}><option value="all">كل التواريخ</option><option value="14">خلال 14 يومًا</option><option value="expired">منتهية التاريخ</option></select></label><button className="packages-refresh" onClick={fetchData}><RefreshCw className={loading ? 'packages-spin' : ''}/></button></section>
    {loading ? <Empty icon={RefreshCw} title="جارٍ تحميل الباقات" text="نسترجع أرصدة الباقات المباعة من الخادم." spin/> : filtered.length ? <><div className="packages-table-wrap"><table><thead><tr><th>العميل والباقة</th><th>الرصيد</th><th>فترة الصلاحية</th><th>الحالة المالية</th><th>الحالة والإجراءات</th></tr></thead><tbody>{filtered.map(pkg => <PackageRow key={pkg.id} pkg={pkg} person={client(pkg.client_id)} canAdjust={canAdjust} canViewDetails={canViewDetails} status={effectiveStatus(pkg)} onDetails={event => openDetailsDialog(pkg, event)} onOwner={event => openPackageDialog('details', pkg, event)}/>)}</tbody></table></div><div className="packages-mobile-list">{filtered.map(pkg => <PackageCard key={pkg.id} pkg={pkg} person={client(pkg.client_id)} canAdjust={canAdjust} canViewDetails={canViewDetails} status={effectiveStatus(pkg)} onDetails={event => openDetailsDialog(pkg, event)} onOwner={event => openPackageDialog('details', pkg, event)}/>)}</div></> : <Empty icon={Archive} title="لا توجد باقات مطابقة" text="غيّر عوامل البحث أو أضف أول باقة مباعة."/>}

    {formOpen && <div className="packages-modal" onMouseDown={event => {if(event.target===event.currentTarget)closeAddDialog()}}><form ref={addDialogRef} className="packages-dialog large" role="dialog" aria-modal="true" aria-labelledby="add-package-title" aria-describedby="add-package-description" onSubmit={submitPackage}><button type="button" aria-label="إغلاق نافذة إضافة الباقة" className="packages-close" onClick={closeAddDialog}><X/></button><span className="packages-dialog-kicker"><PackagePlus/> عملية بيع جديدة</span><h3 id="add-package-title">إضافة باقة لعميل</h3><p id="add-package-description">اختر العميل وقالب الخدمة، ثم راجع الرصيد والسعر قبل الحفظ.</p><div className="packages-form-grid"><label>العميل<select data-dialog-initial required value={form.client_id} onChange={event => setForm({...form,client_id:event.target.value})}><option value="">اختر العميل</option>{clients.map(item => <option key={item.id} value={item.id}>{item.name} — {item.phone1}</option>)}</select></label><label>قالب الخدمة<select required value={form.service_id} onChange={event => selectService(event.target.value)}><option value="">اختر الخدمة</option>{services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>اسم الباقة<input required value={form.name} onChange={event => setForm({...form,name:event.target.value})}/></label><label>وحدة الرصيد<select value={form.billing_unit} onChange={event => setForm({...form,billing_unit:event.target.value})}><option value="hour">ساعة</option><option value="reel">ريل</option></select></label><label>تاريخ البداية<input required type="date" value={form.starts_at} onChange={event => setForm({...form,starts_at:event.target.value})}/></label><label>مدة الصلاحية بالأيام<input required type="number" min="1" value={form.validity_days} onChange={event => setForm({...form,validity_days:event.target.value})}/></label><label>كمية الباقة<input required type="number" min="0.25" step="0.25" value={form.quantity} onChange={event => setForm({...form,quantity:event.target.value})}/></label><label>السعر الإجمالي<input required type="number" min="0" value={form.total_price} onChange={event => setForm({...form,total_price:event.target.value})}/></label><label>المبلغ المدفوع<input required type="number" min="0" max={form.total_price || undefined} value={form.paid_amount} onChange={event => setForm({...form,paid_amount:event.target.value})}/></label><label>طريقة الدفع<select value={form.payment_method} onChange={event => setForm({...form,payment_method:event.target.value})}><option value="cash">كاش</option><option value="bank_transfer">تحويل بنكي</option><option value="vodafone_cash">فودافون كاش</option><option value="instapay">إنستاباي</option></select></label></div><div className="packages-expiry-preview"><CalendarClock/><span>تاريخ الانتهاء المتوقع</span><strong>{expiryPreview}</strong></div><button className="packages-submit" disabled={formBusy}>{formBusy ? <RefreshCw className="packages-spin"/> : <PackagePlus/>}{formBusy ? 'جارٍ إضافة الباقة...' : 'حفظ الباقة وتسجيل الدفعة'}</button></form></div>}

    {modal.open && <OwnerPackageDialog modal={modal} setModal={setModal} person={client(modal.pkg?.client_id)} dialogRef={actionDialogRef} busy={modalBusy} onClose={closeActionDialog} onSubmit={submitModal}/>}
    {details.open && <PackageDetailsDialog dialogRef={detailsDialogRef} details={details} onClose={closeDetailsDialog} onRetry={() => fetchDetails(details.pkg.id)} onTab={tab => setDetails(current => ({ ...current, tab }))}/>}
  </div>;
}

function OwnerPackageDialog({modal,setModal,person,dialogRef,busy,onClose,onSubmit}) {
  const pkg=modal.pkg||{};const financial=packageFinancialSummary({...pkg,total_price:modal.target_total_price,paid_amount:modal.target_paid_amount});const minimum=Number(pkg.consumed_quantity||0)+Number(pkg.held_quantity||0);const quantityAfter=Number(modal.target_quantity||0);const destructive=modal.type==='archive';const hardDelete=packageCanHardDelete(pkg);
  const modes=[['details','بيانات الباقة',Edit3],['hours','الساعات',TimerReset],['commercial','السعر والمدفوع',CircleDollarSign],['archive',hardDelete?'حذف المسودة':'أرشفة',Trash2],['audit','السجل',History]];
  return <div className="packages-modal owner-package-modal" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><form ref={dialogRef} className="packages-dialog owner-console" role="dialog" aria-modal="true" aria-labelledby="package-action-title" aria-describedby="package-action-description" onSubmit={onSubmit}><button type="button" aria-label="إغلاق تحكم المالك" className="packages-close" onClick={onClose}><X/></button><span className="packages-dialog-kicker"><ShieldAlert/> تحكم المالك · أثر مراجعة إلزامي</span><h3 id="package-action-title">{pkg.name}</h3><p id="package-action-description">{person?.name} · كل تغيير يُحفظ بالسبب والوقت والمنفذ ولا يحذف التاريخ المرتبط.</p>
    <nav className="owner-console-tabs" aria-label="أقسام تحكم الباقة">{modes.map(([key,label,Icon],index)=><button data-dialog-initial={index===0?true:undefined} type="button" key={key} className={modal.type===key?'active':destructive&&key==='archive'?'danger':''} onClick={()=>setModal({...modal,type:key})}><Icon/>{label}</button>)}</nav>
    {modal.type==='details'&&<section className="owner-console-fields"><h4>معلومات الباقة</h4><div className="packages-form-grid"><label>اسم العرض<input required value={modal.name} onChange={event=>setModal({...modal,name:event.target.value})}/></label><label>الحالة<select value={modal.status} onChange={event=>setModal({...modal,status:event.target.value})}>{Object.entries(STATUS).map(([key,[label]])=><option key={key} value={key}>{label}</option>)}<option value="cancelled">ملغاة</option></select></label><label>تاريخ البداية<input required type="date" value={modal.starts_at} onChange={event=>setModal({...modal,starts_at:event.target.value})}/></label><label>تاريخ الانتهاء<input required type="date" value={modal.expires_at} onChange={event=>setModal({...modal,expires_at:event.target.value})}/></label></div><label>ملاحظات المالك<textarea rows="2" value={modal.notes} onChange={event=>setModal({...modal,notes:event.target.value})}/></label></section>}
    {modal.type==='hours'&&<section className="owner-console-fields"><h4>التحكم في إجمالي الرصيد</h4><div className="owner-commitment"><span>مستهلك <b>{pkg.consumed_quantity||0}</b></span><span>محجوز <b>{pkg.held_quantity||0}</b></span><span>الحد الأدنى <b>{minimum}</b></span></div><label>إجمالي الساعات / الكمية الجديد<input type="number" required min={minimum} step="0.25" value={modal.target_quantity} onChange={event=>setModal({...modal,target_quantity:event.target.value})}/></label><p className="owner-console-note">المحجوز لا يُعدّل يدويًا. تصحيح الاستهلاك يتم بقيد ledger منفصل فقط.</p></section>}
    {modal.type==='commercial'&&<section className="owner-console-fields"><h4>القيمة التجارية والمدفوع</h4><div className="packages-form-grid"><label>إجمالي سعر الباقة<input type="number" min="0" step="0.01" required value={modal.target_total_price} onChange={event=>setModal({...modal,target_total_price:event.target.value})}/></label><label>المدفوع المستهدف<input type="number" min="0" step="0.01" required value={modal.target_paid_amount} onChange={event=>setModal({...modal,target_paid_amount:event.target.value})}/></label><label>الخزينة المتأثرة<select value={modal.payment_method} onChange={event=>setModal({...modal,payment_method:event.target.value})}>{Object.entries(PAYMENT_METHODS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><p className="owner-console-note">الزيادة تنشئ دفعة وقيد إيراد. الخفض ينشئ قيدًا عكسيًا. لا يتم تعديل «المتبقي» مباشرة.</p></section>}
    {modal.type==='archive'&&<section className="owner-console-fields destructive"><h4>{hardDelete?'حذف المسودة نهائيًا':'أرشفة الباقة'}</h4><p>{hardDelete?'هذه مسودة غير مدفوعة وغير مستهلكة ولا ترتبط بفاتورة ظاهرة. سيطلب الخادم فحص جميع المراجع مرة أخيرة، والحذف النهائي غير قابل للاسترجاع.':'هذه الباقة مرتبطة بتاريخ مالي أو تشغيلي؛ ستُخفى من العمل النشط مع بقاء الدفعات والحجوزات وسجل التدقيق محفوظًا.'}</p><div className="owner-destructive-impact"><span>النتيجة النهائية</span><b>{hardDelete?'حذف دائم للمسودة فقط':'أرشفة مع حفظ التاريخ'}</b><small>{hardDelete?'لا تتأثر خزينة أو فاتورة':'لا حذف لأي قيد مالي أو حجز'}</small></div><label className="owner-confirm"><input type="checkbox" checked={modal.destructiveConfirmed} onChange={event=>setModal({...modal,destructiveConfirmed:event.target.checked})}/> {hardDelete?'أفهم أن حذف المسودة نهائي ولا يمكن التراجع عنه':'أفهم أن الباقة ستتوقف وتبقى في السجل'}</label>{hardDelete&&<label className="owner-delete-confirmation">اكتب DELETE للتأكيد<input value={modal.deleteConfirmation} onChange={event=>setModal({...modal,deleteConfirmation:event.target.value})} autoComplete="off"/></label>}</section>}
    {modal.type==='audit'&&<section className="owner-console-fields"><h4>سجل التعديلات الموثق</h4>{modal.auditLoading?<p className="owner-console-note">جارٍ تحميل سجل التدقيق…</p>:modal.audit.length?<ol className="owner-audit-timeline">{modal.audit.map(item=><li key={item.id}><History/><div><strong>{item.action}</strong><span>{item.actor_name||'مالك النظام'} · {formatDateTime12(item.created_at)}</span><p>{item.after_data?.reason||item.before_data?.reason||'تغيير محفوظ قبل/بعد في سجل التدقيق'}</p></div></li>)}</ol>:<p className="owner-console-note">لا توجد تعديلات سابقة على هذه الباقة.</p>}</section>}
    <section className="owner-impact-strip" aria-label="معاينة أثر التغيير"><article><span>الباقة</span><b>{modal.type==='hours'?`${pkg.purchased_quantity} ← ${quantityAfter}`:`${money(pkg.total_price)} ← ${money(modal.target_total_price)}`}</b></article><article><span>الخزينة</span><b>{modal.type==='commercial'?`${money(pkg.paid_amount)} ← ${money(modal.target_paid_amount)}`:'لا أثر مالي'}</b></article><article><span>الفاتورة / العميل</span><b>{modal.type==='commercial'?`المتبقي ${money(centsToMoney(financial.outstandingCents))}`:'متزامن بعد الحفظ'}</b>{financial.creditCents>0&&<small>رصيد دائن {money(centsToMoney(financial.creditCents))}</small>}</article></section>
    {modal.type!=='audit'&&<><label className="owner-reason">سبب التصحيح<textarea required minLength="5" rows="3" value={modal.reason} onChange={event=>setModal({...modal,reason:event.target.value})} placeholder="اكتب سببًا واضحًا يظهر في سجل المراجعة"/></label><button className={`packages-submit ${destructive?'danger':''}`} disabled={busy||modal.reason.trim().length<5||(destructive&&(!modal.destructiveConfirmed||(hardDelete&&modal.deleteConfirmation!=='DELETE')))}>{busy?<RefreshCw className="packages-spin"/>:<CheckCircle2/>}{busy?'جارٍ تطبيق التغيير...':destructive?(hardDelete?'حذف المسودة نهائيًا':'أرشفة الباقة'):'حفظ التصحيح الموثق'}</button></>}
  </form></div>;
}

function Metric({icon:Icon,label,value,warning,danger}){return <article className={warning?'warning':danger?'danger':''}><Icon/><div><span>{label}</span><strong>{value}</strong></div></article>}
function StatusBadge({status}){return <span className={`package-status ${STATUS[status]?.[1]||'suspended'}`}>{STATUS[status]?.[0]||status}</span>}
function BalanceBar({pkg}){const summary=packageQuantitySummary(pkg);const total=Math.max(1,summary.purchased);return <div className="package-balance"><div className="package-balance-labels"><span>مستخدم <b>{formatPackageQuantity(summary.consumed,pkg.billing_unit)}</b></span><span>محجوز قادمًا <b>{formatPackageQuantity(summary.held,pkg.billing_unit)}</b></span><span>متاح جديد <b>{formatPackageQuantity(summary.available,pkg.billing_unit)}</b></span></div><div className="package-balance-bar" aria-label={`مستخدم ${formatPackageQuantity(summary.consumed,pkg.billing_unit)}، محجوز ${formatPackageQuantity(summary.held,pkg.billing_unit)}، متاح ${formatPackageQuantity(summary.available,pkg.billing_unit)}`}><i className="consumed" style={{width:`${Math.min(100,summary.consumed/total*100)}%`}}/><i className="held" style={{width:`${Math.min(100,summary.held/total*100)}%`}}/><i className="available" style={{width:`${Math.min(100,summary.available/total*100)}%`}}/></div><small>إجمالي الباقة {formatPackageQuantity(summary.purchased,pkg.billing_unit)} · المتبقي غير المستهلك {formatPackageQuantity(summary.remaining,pkg.billing_unit)}</small></div>}
function FinancialStack({pkg}){const financial=packageFinancialSummary(pkg);return <dl className="package-financial-stack"><div><dt>إجمالي سعر الباقة</dt><dd>{money(centsToMoney(financial.totalCents))}</dd></div><div><dt>المدفوع</dt><dd>{money(centsToMoney(financial.paidCents))}</dd></div><div className={financial.outstandingCents>0?'due':'settled'}><dt>المتبقي</dt><dd>{money(centsToMoney(financial.outstandingCents))}</dd></div>{financial.creditCents>0&&<div className="credit"><dt>رصيد دائن للعميل</dt><dd>{money(centsToMoney(financial.creditCents))}</dd></div>}{financial.overageCents>0&&<p>يشمل المتبقي قيمة تجاوز قدرها <strong>{money(centsToMoney(financial.overageCents))}</strong></p>}</dl>}
function Actions({canAdjust,canViewDetails,onDetails,onOwner}){return <div className="package-actions-wrap">{canViewDetails&&<button className="package-details-button" onClick={onDetails}><Eye/> عرض التفاصيل</button>}{canAdjust?<button className="package-owner-button" onClick={onOwner}><MoreVertical/> تحكم المالك</button>:<small className="packages-readonly">إجراءات التصحيح للمالك فقط</small>}</div>}
function PackageRow({pkg,person,canAdjust,canViewDetails,status,onDetails,onOwner}){const workdays=remainingBusinessDays(pkg.expires_at);return <tr><td><strong>{person?.name||'عميل'}</strong><span>{person?.phone1}</span><b>{pkg.name}</b><small>#{pkg.id}</small></td><td><BalanceBar pkg={pkg}/></td><td><strong>{formatBookingDate(pkg.starts_at)}</strong><span>حتى {formatBookingDate(pkg.expires_at)}</span><small>{status==='expired'?'انتهت الصلاحية':`${workdays.toLocaleString('ar-EG-u-nu-latn')} يوم عمل متبقٍ · الجمعة مستثناة`}</small></td><td><FinancialStack pkg={pkg}/></td><td><StatusBadge status={status}/><Actions canAdjust={canAdjust} canViewDetails={canViewDetails} onDetails={onDetails} onOwner={onOwner}/></td></tr>}
function PackageCard({pkg,person,canAdjust,canViewDetails,status,onDetails,onOwner}){const workdays=remainingBusinessDays(pkg.expires_at);return <article className="package-mobile-card"><header><div><strong>{person?.name||'عميل'}</strong><span>{pkg.name} · #{pkg.id}</span></div><StatusBadge status={status}/></header><BalanceBar pkg={pkg}/><FinancialStack pkg={pkg}/><dl className="package-validity-inline"><div><dt>بداية الصلاحية</dt><dd>{formatBookingDate(pkg.starts_at)}</dd></div><div><dt>نهاية الصلاحية</dt><dd>{formatBookingDate(pkg.expires_at)}</dd></div><div><dt>أيام العمل المتبقية</dt><dd>{status==='expired'?'0':workdays.toLocaleString('ar-EG-u-nu-latn')} <small>الجمعة مستثناة</small></dd></div></dl><Actions canAdjust={canAdjust} canViewDetails={canViewDetails} onDetails={onDetails} onOwner={onOwner}/></article>}

function PackageDetailsDialog({dialogRef,details,onClose,onRetry,onTab}){
  const data=details.data;const tab=details.tab;const packageInfo=data?.package;const financial=data?.financial;const quantities=data?.quantities;const validity=data?.validity;
  const tabs=[['payments',ReceiptText,'سجل المدفوعات',data?.payments?.length||0],['used',History,'المواعيد المستخدمة',data?.used_bookings?.length||0],['upcoming',CalendarCheck2,'المواعيد القادمة',data?.upcoming_bookings?.length||0],['audit',ShieldAlert,'سجل المالك',data?.audit_timeline?.length||0]];
  const moveTab=(event,index)=>{let nextIndex=null;if(event.key==='ArrowLeft')nextIndex=(index+1)%tabs.length;if(event.key==='ArrowRight')nextIndex=(index-1+tabs.length)%tabs.length;if(event.key==='Home')nextIndex=0;if(event.key==='End')nextIndex=tabs.length-1;if(nextIndex===null)return;event.preventDefault();const tabButtons=event.currentTarget.parentElement?.querySelectorAll('[role="tab"]');onTab(tabs[nextIndex][0]);requestAnimationFrame(()=>tabButtons?.[nextIndex]?.focus());};
  return <div className="packages-modal packages-details-modal" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section ref={dialogRef} className="package-statement" role="dialog" aria-modal="true" aria-labelledby="package-details-title" aria-describedby="package-details-description"><header className="package-statement-header"><div><span><PackageCheck/> كشف الباقة التشغيلي</span><h2 id="package-details-title">{packageInfo?.name||details.pkg?.name||'تفاصيل الباقة'}</h2><p id="package-details-description">{packageInfo?`${packageInfo.client.name} · الباقة #${packageInfo.id}${packageInfo.invoice_number?` · ${packageInfo.invoice_number}`:''}`:'نجمع المدفوعات والجلسات والأرصدة في كشف واحد.'}</p></div>{packageInfo&&<StatusBadge status={packageInfo.effective_status}/>}<button data-dialog-initial type="button" className="package-statement-close" onClick={onClose} aria-label="إغلاق تفاصيل الباقة"><X/></button></header>
    {details.loading?<div className="package-statement-state"><RefreshCw className="packages-spin"/><strong>جارٍ إعداد كشف الباقة</strong><p>نراجع التخصيصات والجلسات الفعلية والأرصدة.</p></div>:details.error?<div className="package-statement-state error"><ShieldAlert/><strong>تعذر تحميل التفاصيل</strong><p>{details.error}</p><button onClick={onRetry}>إعادة المحاولة</button></div>:data&&<div className="package-statement-scroll">
      <section className="package-health-strip" aria-label="مؤشرات صحة الباقة"><HealthItem label="تحصيل الباقة" value={`${financial.payment_progress_percent}%`} note={`${money(financial.paid_amount)} مدفوع`} progress={financial.payment_progress_percent} tone="payment"/><HealthItem label="استهلاك الرصيد" value={formatPackageQuantity(quantities.used,packageInfo.billing_unit)} note={`من ${formatPackageQuantity(quantities.purchased,packageInfo.billing_unit)}`} progress={quantities.purchased?Math.min(100,quantities.used/quantities.purchased*100):0} tone="usage"/><HealthItem label="أيام العمل المتبقية" value={validity.remaining_business_days.toLocaleString('ar-EG-u-nu-latn')} note="الجمعة مستثناة" progress={validity.state==='expired'?100:validity.state==='near_expiry'?72:35} tone={validity.state}/></section>
      <div className="package-statement-summaries"><section className="package-statement-finance"><header><CircleDollarSign/><div><span>الحالة المالية</span><h3>ملخص التحصيل</h3></div></header><dl><div><dt>إجمالي سعر الباقة</dt><dd>{money(financial.total_price)}</dd></div><div><dt>المدفوع</dt><dd>{money(financial.paid_amount)}</dd></div><div className={Number(financial.outstanding)>0?'due':'settled'}><dt>المتبقي</dt><dd>{money(financial.outstanding)}</dd></div>{Number(financial.customer_credit)>0&&<div className="credit"><dt>رصيد دائن للعميل</dt><dd>{money(financial.customer_credit)}</dd></div>}</dl>{Number(financial.overage_amount)>0&&<p className="package-overage-note">يتضمن الرصيد المتبقي تجاوزًا بقيمة <strong>{money(financial.overage_amount)}</strong>.</p>}{financial.has_legacy_reconciliation&&<div className="package-reconciliation"><ShieldAlert/><p><strong>تسوية سجل قديم: {money(data.reconciliation.legacy_unallocated_amount)}</strong>{data.reconciliation.disclosure}</p></div>}</section>
      <section className="package-statement-hours"><header><TimerReset/><div><span>حركة الرصيد</span><h3>الساعات والاستخدام</h3></div></header><dl><div><dt>إجمالي المشترى</dt><dd>{formatPackageQuantity(quantities.purchased,packageInfo.billing_unit)}</dd></div><div><dt>المستخدم فعليًا</dt><dd>{formatPackageQuantity(quantities.used,packageInfo.billing_unit)}</dd></div><div><dt>محجوز قادمًا</dt><dd>{formatPackageQuantity(quantities.upcoming_held,packageInfo.billing_unit)}</dd></div><div><dt>المتبقي</dt><dd>{formatPackageQuantity(quantities.remaining,packageInfo.billing_unit)}</dd></div><div className="available"><dt>متاح لحجز جديد</dt><dd>{formatPackageQuantity(quantities.available,packageInfo.billing_unit)}</dd></div></dl></section>
      <section className={`package-statement-validity ${validity.state}`}><header><CalendarClock/><div><span>فترة التعاقد</span><h3>صلاحية الباقة</h3></div></header><dl><div><dt>تاريخ البداية</dt><dd>{formatBookingDate(validity.starts_at)}</dd></div><div><dt>تاريخ الانتهاء</dt><dd>{formatBookingDate(validity.expires_at)}</dd></div><div><dt>أيام العمل المتبقية</dt><dd>{validity.remaining_business_days.toLocaleString('ar-EG-u-nu-latn')} يوم</dd></div></dl><p>الحساب من اليوم التالي وحتى تاريخ الانتهاء؛ الجمعة مستثناة بالكامل دون تغيير تاريخ انتهاء الباقة.</p></section></div>
      <section className="package-history"><nav role="tablist" aria-label="سجلات الباقة" aria-orientation="horizontal">{tabs.map(([key,Icon,label,count],index)=><button key={key} id={`package-tab-${key}`} role="tab" aria-selected={tab===key} aria-controls={`package-panel-${key}`} tabIndex={tab===key?0:-1} className={tab===key?'active':''} onClick={()=>onTab(key)} onKeyDown={event=>moveTab(event,index)}><Icon/><span>{label}</span><b>{count}</b></button>)}</nav><div id={`package-panel-${tab}`} role="tabpanel" aria-labelledby={`package-tab-${tab}`} tabIndex="0">{tab==='payments'?<PaymentHistory items={data.payments}/>:tab==='used'?<UsedHistory items={data.used_bookings} billingUnit={packageInfo.billing_unit}/>:tab==='upcoming'?<UpcomingHistory items={data.upcoming_bookings} billingUnit={packageInfo.billing_unit}/>:<AuditHistory items={data.audit_timeline||[]}/>}</div></section>
    </div>}</section></div>;
}
function HealthItem({label,value,note,progress,tone}){return <article className={tone}><span>{label}</span><strong>{value}</strong><small>{note}</small><div aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,progress))}%`}}/></div></article>}
function PaymentHistory({items}){if(!items.length)return <HistoryEmpty icon={ReceiptText} title="لا توجد دفعات مخصصة" text="لم تُسجل تخصيصات دفع مباشرة أو سجلات فاتورة قديمة لهذه الباقة."/>;return <div className="package-history-list">{items.map(item=><article key={`${item.allocation_source}-${item.allocation_id}`} className={item.is_exact_package_amount?'exact':'legacy'}><div className="package-history-icon">{item.is_exact_package_amount?<CheckCircle2/>:<ShieldAlert/>}</div><div className="package-history-main"><header><strong>{item.is_exact_package_amount?money(item.amount):'دفعة فاتورة قديمة'}</strong><span className={`package-record-status ${item.status}`}>{item.status==='approved'?'معتمدة':item.status||'مسجلة'}</span></header><p>{formatDateTime12(item.reviewed_at||item.created_at)} · {PAYMENT_METHODS[item.method]||item.method||'طريقة غير محددة'}</p><small>{item.reference?`مرجع ${item.reference}`:'دون مرجع'}{item.invoice_number?` · فاتورة ${item.invoice_number}`:''}{item.proof_name?' · يوجد إثبات مرفق':''}</small>{!item.is_exact_package_amount&&<em>{item.allocation_note} مبلغ حركة الفاتورة: {money(item.amount)}</em>}</div></article>)}</div>}
function UsedHistory({items,billingUnit}){if(!items.length)return <HistoryEmpty icon={History} title="لا توجد جلسات مستخدمة" text="سيظهر هنا الوقت الفعلي المحفوظ بعد إنهاء أول جلسة مرتبطة بالباقة."/>;return <div className="package-history-list">{items.map(item=>{const legacy=item.record_type==='legacy_consumption';return <article key={item.id} className={legacy?'legacy-consumption':''}><div className="package-history-icon">{legacy?<ShieldAlert/>:<Clock3/>}</div><div className="package-history-main"><header><strong>{item.service||'جلسة تصوير'}</strong><span className={`package-record-status ${legacy?'reconciled':'completed'}`}>{legacy?'مصالحة':'مكتملة'}</span></header>{legacy?<><p>قيد استهلاك محفوظ منذ {formatBookingDate(item.date)}</p><dl><div><dt>المخصوم من الباقة</dt><dd>{formatPackageQuantity(item.consumed_quantity,billingUnit)}</dd></div></dl><em>{item.reconciliation_note}</em></>:<><p>{formatBookingDate(item.date)} · {formatTime12(item.start_time)} – {formatTime12(item.end_time)}</p><dl><div><dt>الوقت الفعلي المحفوظ</dt><dd>{formatPackageQuantity(Number(item.actual_seconds||0)/3600,'hour')}</dd></div><div><dt>المخصوم من الباقة</dt><dd>{formatPackageQuantity(item.consumed_quantity||item.actual_quantity,billingUnit)}</dd></div></dl><small>{item.ended_by_name?`أنهى الجلسة ${item.ended_by_name}`:'جلسة نهائية محفوظة'}{item.adjustment_reason?` · ${item.adjustment_reason}`:''}</small></>}</div></article>})}</div>}
function UpcomingHistory({items,billingUnit}){if(!items.length)return <HistoryEmpty icon={CalendarCheck2} title="لا توجد مواعيد قادمة" text="لا توجد حجوزات مستقبلية مرتبطة بهذه الباقة في الحالات النشطة."/>;return <div className="package-history-list">{items.map(item=><article key={item.id}><div className="package-history-icon"><CalendarCheck2/></div><div className="package-history-main"><header><strong>{item.service||'موعد تصوير'}</strong><span className={`package-record-status ${item.status}`}>{BOOKING_STATUS[item.status]||item.status}</span></header><p>{formatBookingDate(item.date)} · {formatTime12(item.start_time)} – {formatTime12(item.end_time)}</p><small>المخطط: {formatPackageQuantity(item.requested_quantity,billingUnit)}{item.resource_name?` · ${item.resource_name}`:''}</small></div></article>)}</div>}
function AuditHistory({items}){if(!items.length)return <HistoryEmpty icon={ShieldAlert} title="لا توجد تصحيحات" text="ستظهر هنا تعديلات المالك والإلغاءات والأرشفة."/>;return <div className="package-history-list">{items.map(item=><article key={item.id}><div className="package-history-icon"><ShieldAlert/></div><div className="package-history-main"><header><strong>{item.action}</strong><span className="package-record-status reconciled">موثق</span></header><p>{formatDateTime12(item.created_at)} · {item.actor_name||'مالك النظام'}</p></div></article>)}</div>}
function HistoryEmpty({icon:Icon,title,text}){return <div className="package-history-empty"><Icon/><strong>{title}</strong><p>{text}</p></div>}
function Empty({icon:Icon,title,text,spin}){return <div className="packages-empty"><Icon className={spin?'packages-spin':''}/><h3>{title}</h3><p>{text}</p></div>}
