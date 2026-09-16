import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, CircleDollarSign, Clock3, PackageCheck, PackagePlus } from 'lucide-react';
import ClientCombobox from '../components/ClientCombobox';
import DurationHoursMinutesInput from '../components/DurationHoursMinutesInput';
import { formatBookingDate, formatDurationMinutes, formatEGP } from '../lib/businessFormat';
import {
  bookingBlockPackageEligibility,
  newPackageDraftForBlock,
  sellableHourTemplates,
  validateBookingBlockNewPackage,
} from '../lib/bookingBlockConversion';
import { buildPackageServiceGroups } from '../lib/packageBookingPicker';
import './BookingBlockConversionForm.css';

const newKey = () => globalThis.crypto?.randomUUID?.() || `convert-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const PAYMENT_METHODS = { cash: 'كاش', bank_transfer: 'تحويل بنكي', vodafone_cash: 'فودافون كاش', instapay: 'إنستاباي' };

export default function BookingBlockConversionForm({ block, clients, packages, services, busy, onConvert }) {
  const requestKeyRef = useRef(newKey());
  const [clientId, setClientId] = useState('');
  const [mode, setMode] = useState('existing_package');
  const [packageId, setPackageId] = useState('');
  const [category, setCategory] = useState('');
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const clientPackages = useMemo(() => packages.filter(pkg => String(pkg.client_id) === String(clientId)), [clientId, packages]);
  const templates = useMemo(() => sellableHourTemplates(services), [services]);
  const templateGroups = useMemo(() => buildPackageServiceGroups(templates), [templates]);
  const serviceById = id => services.find(service => String(service.id) === String(id));
  const packageOptions = clientPackages
    .map(pkg => ({ pkg, state: bookingBlockPackageEligibility(pkg, block, serviceById(pkg.service_id)) }))
    .sort((left, right) => {
      if (left.state.eligible !== right.state.eligible) return left.state.eligible ? -1 : 1;
      const leftExpiry = String(left.pkg.expires_at || '9999-12-31').slice(0, 10);
      const rightExpiry = String(right.pkg.expires_at || '9999-12-31').slice(0, 10);
      return leftExpiry.localeCompare(rightExpiry) || Number(right.pkg.id || 0) - Number(left.pkg.id || 0);
    });
  const eligiblePackages = packageOptions.filter(option => option.state.eligible);
  const eligibleRankById = new Map(eligiblePackages.map((option, index) => [String(option.pkg.id), index + 1]));
  const selectedPackage = packageOptions.find(option => String(option.pkg.id) === String(packageId));
  const selectedTemplate = templates.find(service => String(service.id) === String(draft?.service_id));

  const chooseClient = value => {
    const next = String(value || '');
    if (!next) { setClientId(''); setPackageId(''); setMode('new_package'); setCategory(''); setDraft(null); setErrors({}); return; }
    const priority = packages
      .filter(pkg => String(pkg.client_id) === next)
      .map(pkg => ({ pkg, state: bookingBlockPackageEligibility(pkg, block, serviceById(pkg.service_id)) }))
      .filter(option => option.state.eligible)
      .sort((left, right) => String(left.pkg.expires_at || '9999-12-31').localeCompare(String(right.pkg.expires_at || '9999-12-31')) || Number(left.pkg.id || 0) - Number(right.pkg.id || 0))[0];
    setClientId(next); setPackageId(priority ? String(priority.pkg.id) : ''); setMode(priority ? 'existing_package' : 'new_package'); setCategory(''); setDraft(null); setErrors({});
  };
  const chooseTemplate = serviceId => {
    const service = templates.find(item => String(item.id) === String(serviceId));
    setDraft(service ? newPackageDraftForBlock(service, clientId, block.block_date) : null); setErrors({});
  };
  const setField = (field, value) => { setDraft(current => ({ ...current, [field]: value })); setErrors(current => ({ ...current, [field]: undefined })); };
  const submit = () => {
    if (mode === 'existing_package') {
      if (!selectedPackage?.state.eligible) return setErrors({ existing: 'اختر باقة ساعات مؤهلة للحجز.' });
      onConvert?.({ package_mode: 'existing_package', client_id: Number(clientId), client_package_id: Number(packageId), idempotency_key: requestKeyRef.current });
      return;
    }
    const validation = validateBookingBlockNewPackage(draft, selectedTemplate, block); setErrors(validation);
    if (Object.keys(validation).length) return;
    onConvert?.({ package_mode: 'new_package', client_id: Number(clientId), idempotency_key: requestKeyRef.current, new_package: {
      service_id: Number(draft.service_id), name: draft.name, billing_unit: 'hour', quantity: Number(draft.quantity), validity_days: Number(draft.validity_days), payment_due_quantity: Number(draft.payment_due_quantity), deposit_percent_snapshot: Number(draft.deposit_percent_snapshot), overage_price_snapshot: String(draft.overage_price_snapshot), total_price: String(draft.total_price), paid_amount: String(draft.paid_amount), payment_method: draft.payment_method, notes: draft.notes,
    } });
  };
  const errorFor = field => errors[field] ? <small className="booking-convert-error">{errors[field]}</small> : null;

  return <section className="booking-block-convert" aria-labelledby="booking-convert-title">
    <h3 id="booking-convert-title"><PackageCheck/>تحويل إلى حجز عميل</h3>
    <p>سيتم حجز {formatDurationMinutes(block.duration_minutes)} وإنشاء كل السجلات في عملية واحدة.</p>
    <ClientCombobox clients={clients} value={clientId} onChange={chooseClient} label="العميل" required />
    {clientId && <>
      <div className="booking-convert-modes" role="radiogroup" aria-label="طريقة ربط الباقة">
        <button type="button" role="radio" aria-checked={mode === 'existing_package'} className={mode === 'existing_package' ? 'active' : ''} onClick={() => setMode('existing_package')}><PackageCheck/><span><strong>استخدام باقة موجودة</strong><small>{eligiblePackages.length ? `${eligiblePackages.length} باقة مؤهلة` : 'لا توجد باقة مؤهلة حاليًا'}</small></span></button>
        <button type="button" role="radio" aria-checked={mode === 'new_package'} className={mode === 'new_package' ? 'active' : ''} onClick={() => setMode('new_package')}><PackagePlus/><span><strong>إنشاء باقة جديدة</strong><small>بيع باقة ساعات وربط هذا الموعد فورًا</small></span></button>
      </div>
      {mode === 'existing_package' ? <div className="booking-existing-packages">
        {!packageOptions.length && <div className="booking-convert-empty"><PackagePlus/><strong>هذا العميل ليس لديه باقات بعد.</strong><button type="button" onClick={() => setMode('new_package')}>أنشئ باقة جديدة الآن</button></div>}
        {packageOptions.map(({ pkg, state }) => <button type="button" key={pkg.id} disabled={!state.eligible} className={String(pkg.id) === String(packageId) ? 'selected' : ''} onClick={() => { setPackageId(String(pkg.id)); setErrors({}); }}>
          <span><strong>{pkg.name}</strong><small>{state.eligible ? `${eligibleRankById.get(String(pkg.id)) === 1 ? 'الأولوية الآن' : 'باقة تالية'} · متاح ${formatDurationMinutes(state.availableMinutes)} · ${pkg.expires_at ? `حتى ${formatBookingDate(pkg.expires_at)}` : 'تبدأ من أول حجز'}` : state.reason}</small></span>
          <b>{state.eligible ? `يتبقى ${formatDurationMinutes(state.remainingMinutes)}` : 'غير مؤهلة'}</b>
        </button>)}
        {errorFor('existing')}
      </div> : <div className="booking-new-package">
        <div className="booking-new-template-grid">
          <label>نوع الباقة<select value={category} onChange={event => { setCategory(event.target.value); setDraft(null); setErrors({}); }}><option value="">اختر النوع</option>{templateGroups.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}</select></label>
          <label>قالب باقة الساعات<select disabled={!category} value={draft?.service_id || ''} onChange={event => chooseTemplate(event.target.value)}><option value="">اختر القالب</option>{(templateGroups.find(group => group.key === category)?.services || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errorFor('service_id')}</label>
        </div>
        {draft && <>
          <div className="booking-new-commercial">
            <label>اسم الباقة<input value={draft.name} onChange={event => setField('name', event.target.value)}/>{errorFor('name')}</label>
            <DurationHoursMinutesInput idPrefix="booking-convert-balance" label="رصيد الساعات" value={draft.quantity} minMinutes={block.duration_minutes} onChange={value => setField('quantity', value)}/>
            <label>مدة الصلاحية بالأيام<input type="number" min="1" max="3650" value={draft.validity_days} disabled={draft.validity_mode_snapshot === 'shooting_day'} onChange={event => { const next={...draft,validity_days:event.target.value}; setDraft({...next,expires_at:next.validity_mode_snapshot==='shooting_day'?block.block_date:newPackageDraftForBlock({...selectedTemplate,validity_days:event.target.value},clientId,block.block_date)?.expires_at||draft.expires_at}); }}/>{errorFor('validity_days')}</label>
            <DurationHoursMinutesInput idPrefix="booking-convert-due" label="حد الاستحقاق" value={draft.payment_due_quantity} maxMinutes={Number(draft.quantity || 0) * 60} onChange={value => setField('payment_due_quantity', value)}/>
            <label>نسبة المقدم %<input type="number" min="0" max="100" step="0.01" value={draft.deposit_percent_snapshot} onChange={event => setField('deposit_percent_snapshot', event.target.value)}/>{errorFor('deposit_percent_snapshot')}</label>
            <label>سعر الساعة الإضافية<input type="number" min="0" step="0.01" value={draft.overage_price_snapshot} onChange={event => setField('overage_price_snapshot', event.target.value)}/>{errorFor('overage_price_snapshot')}</label>
            <label>السعر الإجمالي<input type="number" min="0" step="0.01" value={draft.total_price} onChange={event => setField('total_price', event.target.value)}/>{errorFor('total_price')}</label>
            <label>المدفوع الآن<input type="number" min="0" step="0.01" value={draft.paid_amount} onChange={event => setField('paid_amount', event.target.value)}/>{errorFor('paid_amount')}</label>
            <label>طريقة الدفع<select value={draft.payment_method} onChange={event => setField('payment_method', event.target.value)}>{Object.entries(PAYMENT_METHODS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>{errorFor('payment_method')}</label>
            <label className="wide">ملاحظات البيع<textarea rows="2" value={draft.notes} onChange={event => setField('notes', event.target.value)}/></label>
          </div>
          {errorFor('quantity')}{errorFor('schedule')}
          <dl className="booking-new-summary">
            <div><dt><Clock3/>الرصيد المشترى</dt><dd>{formatDurationMinutes(Number(draft.quantity || 0) * 60)}</dd></div><div><dt>المحجوز الآن</dt><dd>{formatDurationMinutes(block.duration_minutes)}</dd></div><div><dt>المتاح بعد الحجز</dt><dd>{formatDurationMinutes(Math.max(0,Number(draft.quantity||0)*60-block.duration_minutes))}</dd></div><div><dt>الصلاحية</dt><dd>{formatBookingDate(block.block_date)} — {formatBookingDate(draft.expires_at)}</dd></div><div><dt><CircleDollarSign/>الإجمالي</dt><dd>{formatEGP(draft.total_price)}</dd></div><div><dt>المدفوع / المتبقي</dt><dd>{formatEGP(draft.paid_amount)} / {formatEGP(Math.max(0,Number(draft.total_price||0)-Number(draft.paid_amount||0)))}</dd></div>
          </dl>
        </>}
      </div>}
      <button type="button" className="primary booking-convert-submit" disabled={busy || (mode === 'existing_package' ? !packageId : !draft)} onClick={submit}><ArrowLeft/>{busy ? 'جارٍ التحويل…' : mode === 'new_package' ? 'بيع الباقة وتحويل الحجز' : 'تحويل وحجز المدة'}</button>
    </>}
  </section>;
}
