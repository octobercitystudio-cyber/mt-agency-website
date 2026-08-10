import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { CUSTOM_SERVICES, serviceMeta } from './customServices';
import { getProjectStageTemplate } from '../lib/projectStageTemplates';
import CustomServiceSchedule from './CustomServiceSchedule';
import { customSlotValidation } from './customServiceSlot';

const PRICING_LABELS = { per_reel: 'لكل ريل', custom: 'تسعير مخصص', equipment: 'حسب التجهيزات', project: 'سعر ثابت للمشروع', hourly: 'لكل ساعة', monthly: 'شهري', per_video: 'لكل فيديو' };
const STATUS_LABELS = { planning: 'تخطيط', active: 'قيد التنفيذ', on_hold: 'معلق' };
const moneyCents = value => Math.round((Number(value) || 0) * 100);
const money = cents => (cents / 100).toFixed(2);
const itemKey = () => `item_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const buildInitial = (serviceType = 'custom', clientId = '') => {
  const meta = serviceMeta(serviceType);
  return {
    client_id: clientId ? String(clientId) : '', service_type: serviceType, name: '', description: '', requirements: '',
    starts_at: new Date().toISOString().slice(0, 10), due_at: '', assigned_to: '', status: 'planning',
    pricing_model: meta.pricing[0] || 'custom', paid_amount: '0.00', requires_booking: false,
  };
};

const buildItem = unit => ({ key: itemKey(), description: '', quantity: '1', unit: unit || 'مشروع', unit_price: '0.00', internal_cost: '0.00', is_client_visible: true });

export default function CustomServiceForm({ clients = [], initialService = 'custom', initialClientId = '', busy = false, error = '', onSubmit }) {
  const [form, setForm] = useState(() => buildInitial(initialService, initialClientId));
  const [items, setItems] = useState(() => [buildItem(serviceMeta(initialService).unit)]);
  const [stages, setStages] = useState(() => getProjectStageTemplate(initialService || 'custom'));
  const [localError, setLocalError] = useState('');
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [schedule, setSchedule] = useState({ resource_id: '', date: '', start_time: '12:00', end_time: '13:00' });
  const scheduleRef = useRef(null);
  const requestKeyRef = useRef('');
  const service = serviceMeta(form.service_type);
  const totalCents = useMemo(() => items.reduce((sum, item) => sum + moneyCents(item.unit_price) * (Number(item.quantity) || 0), 0), [items]);
  const paidCents = moneyCents(form.paid_amount);
  const remainingCents = Math.max(0, totalCents - paidCents);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('resources').select('*').eq('is_active', 1),
      supabase.from('bookings').select('*'),
    ]).then(([resourceResult, bookingResult]) => {
      if (!active) return;
      setResources(resourceResult.data || []);
      setBookings(bookingResult.data || []);
      const first = (resourceResult.data || [])[0];
      if (first) setSchedule(previous => previous.resource_id ? previous : { ...previous, resource_id: String(first.id) });
    });
    return () => { active = false; };
  }, []);

  const set = updates => setForm(previous => ({ ...previous, ...updates }));
  const setService = serviceType => {
    const meta = serviceMeta(serviceType);
    set({ service_type: serviceType, pricing_model: meta.pricing[0] || 'custom', requires_booking: false });
    setItems([buildItem(meta.unit)]);
    setStages(getProjectStageTemplate(serviceType || 'custom'));
    setLocalError('');
  };
  const updateItem = (index, updates) => setItems(values => values.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item));
  const move = (setter, index, direction) => setter(values => { const target = index + direction; if (target < 0 || target >= values.length) return values; const copy = [...values]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy; });

  const submit = event => {
    event.preventDefault();
    if (busy) return;
    if (!requestKeyRef.current) requestKeyRef.current = globalThis.crypto?.randomUUID?.() || `custom-${itemKey()}`;
    setLocalError('');
    const normalizedStages = stages.map((stage, index) => ({ ...stage, title: String(stage.title || '').trim(), sort_order: index })).filter(stage => stage.title);
    if (normalizedStages.length < 2) return setLocalError('يجب إضافة مرحلتي إنتاج على الأقل.');
    const normalizedItems = items.map((item, index) => ({
      description: String(item.description || '').trim(), quantity: Number(item.quantity), unit: String(item.unit || '').trim(),
      unit_price: Number(money(moneyCents(item.unit_price))), total_price: Number(money(moneyCents(item.unit_price) * Number(item.quantity))),
      internal_cost: Number(money(moneyCents(item.internal_cost))), is_client_visible: Boolean(item.is_client_visible), sort_order: index,
    }));
    if (!normalizedItems.length || normalizedItems.some(item => !item.description || !item.unit || item.quantity <= 0 || item.unit_price < 0 || item.internal_cost < 0)) return setLocalError('أكمل وصف وكمية ووحدة وسعر كل بند.');
    if (paidCents > totalCents) return setLocalError('المدفوع مبدئيًا لا يمكن أن يتجاوز إجمالي الخدمة.');
    if (form.requires_booking) {
      const result = customSlotValidation(schedule, bookings);
      if (!result.available) { setLocalError(result.message); scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); scheduleRef.current?.querySelector('select, input')?.focus(); return; }
    }
    onSubmit({
      idempotency_key: requestKeyRef.current, client_id: Number(form.client_id), service_type: form.service_type, name: form.name.trim(), status: form.status,
      starts_at: form.starts_at, due_at: form.due_at || '', pricing_model: form.pricing_model, quantity: 1, unit_label: 'project',
      agreed_price: Number(money(totalCents)), paid_amount: Number(money(paidCents)), requires_booking: form.requires_booking,
      requirements_json: { description: form.description.trim(), client_requirements: form.requirements.trim(), assigned_to: form.assigned_to.trim() || null },
      notes: form.description.trim(), items: normalizedItems,
      milestones: normalizedStages.map((stage, index) => ({ title: stage.title, status: 'pending', progress_percent: 0, is_client_visible: true, sort_order: index })),
      booking: form.requires_booking ? { ...schedule, resource_id: Number(schedule.resource_id), service: form.name.trim(), status: 'pending', notes: form.requirements.trim() } : null,
    });
  };

  return <form className="custom-service-form" onSubmit={submit} noValidate={false}>
    <div className="custom-form-intro"><span className="dialog-kicker">خدمة مخصصة جديدة</span><h2 id="project-modal-title">ابنِ الخدمة حسب احتياج العميل</h2><p>ستظهر الخدمة تلقائيًا في المشروعات والمحتوى، مع إضافة موعد اختياري إن لزم.</p></div>

    <fieldset className="custom-form-section"><legend><b>01</b><span>الخدمة والعميل</span></legend><div className="form-grid">
      <label>العميل<select required value={form.client_id} onChange={event => set({ client_id: event.target.value })}><option value="">اختر العميل</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label>نوع الخدمة<select value={form.service_type} onChange={event => setService(event.target.value)}>{Object.entries(CUSTOM_SERVICES).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label>
      <label>الحالة<select value={form.status} onChange={event => set({ status: event.target.value })}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="wide-field">اسم المشروع / الخدمة<input required value={form.name} onChange={event => set({ name: event.target.value })} placeholder="مثال: إطلاق حملة منتج جديد"/></label>
      <label>تاريخ البدء<input required type="date" value={form.starts_at} onChange={event => set({ starts_at: event.target.value })}/></label>
      <label>التسليم المتوقع<input type="date" min={form.starts_at} value={form.due_at} onChange={event => set({ due_at: event.target.value })}/></label>
      <label>المسؤول<input value={form.assigned_to} onChange={event => set({ assigned_to: event.target.value })} placeholder="اسم المسؤول أو الموظف"/></label>
      <label className="wide-field">وصف الخدمة<textarea rows="3" value={form.description} onChange={event => set({ description: event.target.value })} placeholder="ما الذي سيتم تنفيذه وتسليمه؟"/></label>
      <label className="wide-field">متطلبات العميل<textarea rows="3" value={form.requirements} onChange={event => set({ requirements: event.target.value })} placeholder="التفاصيل، المراجع، التجهيزات وشروط التسليم..."/></label>
    </div></fieldset>

    <fieldset className="custom-form-section"><legend><b>02</b><span>مراحل الإنتاج</span></legend><div className="stage-template-heading"><p>رتّب مراحل العمل بالشكل الذي سيراه العميل.</p><span>{stages.length.toLocaleString('ar-EG')} مراحل</span></div><div className="stage-template-editor">
      {stages.map((stage, index) => <div className="stage-template-row" key={stage.key || `${stage.title}_${index}`}><b>{(index + 1).toLocaleString('ar-EG')}</b><input required value={stage.title} aria-label={`اسم المرحلة ${index + 1}`} onChange={event => setStages(values => values.map((value, itemIndex) => itemIndex === index ? { ...value, title: event.target.value } : value))}/><div className="stage-order-actions"><button type="button" disabled={index === 0} onClick={() => move(setStages, index, -1)} aria-label="تحريك لأعلى"><ArrowUp/></button><button type="button" disabled={index === stages.length - 1} onClick={() => move(setStages, index, 1)} aria-label="تحريك لأسفل"><ArrowDown/></button></div><button type="button" className="stage-delete" disabled={stages.length <= 2} onClick={() => setStages(values => values.filter((_, itemIndex) => itemIndex !== index))} aria-label="حذف المرحلة"><Trash2/></button></div>)}
    </div><button type="button" className="add-stage-button" onClick={() => setStages(values => [...values, { key: itemKey(), title: 'مرحلة جديدة' }])}><Plus/> إضافة مرحلة</button></fieldset>

    <fieldset className="custom-form-section"><legend><b>03</b><span>البنود والتسعير</span></legend><div className="custom-pricing-head"><label>نموذج التسعير<select value={form.pricing_model} onChange={event => set({ pricing_model: event.target.value })}>{service.pricing.map(value => <option key={value} value={value}>{PRICING_LABELS[value] || value}</option>)}</select></label><p>الإجمالي يُحسب تلقائيًا من البنود بدقة القرش.</p></div><div className="custom-items-editor">
      <div className="custom-items-labels"><span>البند</span><span>الكمية</span><span>الوحدة</span><span>سعر الوحدة</span><span>الإجمالي</span><span>التكلفة</span><span>للعميل</span><span>ترتيب</span></div>
      {items.map((item, index) => <div className="custom-item-row" key={item.key}>
        <label className="custom-item-field item-description"><span>البند</span><input required value={item.description} onChange={event => updateItem(index, { description: event.target.value })} placeholder="وصف البند"/></label>
        <label className="custom-item-field"><span>الكمية</span><input required type="number" min="0.01" step="0.01" value={item.quantity} onChange={event => updateItem(index, { quantity: event.target.value })}/></label>
        <label className="custom-item-field"><span>الوحدة</span><input required value={item.unit} onChange={event => updateItem(index, { unit: event.target.value })}/></label>
        <label className="custom-item-field"><span>سعر الوحدة</span><input required type="number" min="0" step="0.01" value={item.unit_price} onChange={event => updateItem(index, { unit_price: event.target.value })}/></label>
        <div className="custom-item-total"><span>الإجمالي</span><output>{money(moneyCents(item.unit_price) * (Number(item.quantity) || 0))}</output></div>
        <label className="custom-item-field"><span>التكلفة</span><input type="number" min="0" step="0.01" value={item.internal_cost} onChange={event => updateItem(index, { internal_cost: event.target.value })}/></label>
        <button type="button" className={`item-visibility ${item.is_client_visible ? 'is-visible' : ''}`} onClick={() => updateItem(index, { is_client_visible: !item.is_client_visible })} aria-label="تغيير ظهور البند للعميل">{item.is_client_visible ? <Eye/> : <EyeOff/>}<span>{item.is_client_visible ? 'ظاهر' : 'مخفي'}</span></button>
        <div className="item-order-actions"><button type="button" disabled={index === 0} onClick={() => move(setItems, index, -1)} aria-label={`تحريك ${item.description || 'البند'} لأعلى`}><ArrowUp/></button><button type="button" disabled={index === items.length - 1} onClick={() => move(setItems, index, 1)} aria-label={`تحريك ${item.description || 'البند'} لأسفل`}><ArrowDown/></button><button type="button" className="item-remove" disabled={items.length === 1} onClick={() => setItems(values => values.filter((_, itemIndex) => itemIndex !== index))} aria-label="حذف البند"><Trash2/></button></div>
      </div>)}
    </div><button type="button" className="add-starter-item" onClick={() => setItems(values => [...values, buildItem(service.unit)])}><Plus/> إضافة بند</button><div className="custom-financial-summary"><article><span>إجمالي الخدمة</span><strong>{money(totalCents)} <small>ج.م</small></strong></article><label>المدفوع مبدئيًا<input type="number" min="0" step="0.01" max={money(totalCents)} value={form.paid_amount} onChange={event => set({ paid_amount: event.target.value })}/></label><article className="remaining"><span>المتبقي</span><strong>{money(remainingCents)} <small>ج.م</small></strong></article></div></fieldset>

    <fieldset className="custom-form-section custom-booking-toggle"><legend><b>04</b><span>الموعد الاختياري</span></legend><label className="form-check booking-toggle"><input type="checkbox" checked={form.requires_booking} onChange={event => set({ requires_booking: event.target.checked })}/><span><strong>إضافة موعد لهذه الخدمة في جدول الحجوزات</strong><small>عند تفعيله، سيُنشأ الموعد بحالة «بانتظار التأكيد» دون المساس برصيد أي باقة.</small></span></label>{form.requires_booking && <CustomServiceSchedule sectionRef={scheduleRef} value={schedule} onChange={setSchedule} resources={resources} bookings={bookings}/>}</fieldset>

    {(localError || error) && <p className="custom-form-error" role="alert">{localError || error}</p>}
    <footer className="custom-form-footer"><span><Check/> سيتم إدراجها فورًا في المشروعات والمحتوى.</span><button className="dialog-submit" disabled={busy}>{busy ? <RefreshCw className="spin"/> : <Plus/>}{busy ? 'جارٍ الإنشاء...' : 'إنشاء الخدمة المخصصة'}</button></footer>
  </form>;
}
