import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarClock, Check, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { CUSTOM_SERVICES, serviceMeta } from './customServices';
import BusinessTimeSelect from '../components/BusinessTimeSelect';
import { getProjectStageTemplate } from '../lib/projectStageTemplates';

const bookingTypes = new Set(['reels', 'podcast', 'event_coverage', 'advertising']);
const PRICING_LABELS = { per_reel: 'لكل ريل', custom: 'تسعير مخصص', equipment: 'حسب التجهيزات', project: 'سعر ثابت للمشروع', hourly: 'لكل ساعة تصوير', monthly: 'شهري', per_video: 'لكل فيديو' };
const buildInitial = serviceType => ({
  client_id: '', service_type: serviceType || 'reels', name: '', starts_at: '', due_at: '',
  pricing_model: serviceMeta(serviceType || 'reels').pricing[0], quantity: 1,
  unit_label: serviceMeta(serviceType || 'reels').unit, agreed_price: '', paid_amount: 0,
  requires_booking: false, booking_date: '', booking_start_time: '12:00', booking_end_time: '13:00',
  requirements: '', editing_included: false, platform_list: '', platform_count: '', post_count: '',
  video_count: '', paid_ads: false, social_notes: '', software_platform: 'web',
});

export default function CustomServiceForm({ clients, initialService, busy, onSubmit }) {
  const [form, setForm] = useState(() => buildInitial(initialService));
  const [items, setItems] = useState([{ title: '', quantity: 1, unit_label: serviceMeta(initialService).unit }]);
  const [stages, setStages] = useState(() => getProjectStageTemplate(initialService || 'reels', { editingIncluded: false }));
  const [stageError, setStageError] = useState('');
  const podcastEditingStage = useRef(null);
  const service = serviceMeta(form.service_type);
  const canBook = bookingTypes.has(form.service_type);
  const set = updates => setForm(previous => ({ ...previous, ...updates }));
  const setService = serviceType => {
    const meta = serviceMeta(serviceType);
    set({ service_type: serviceType, pricing_model: meta.pricing[0], unit_label: meta.unit, requires_booking: false });
    setItems([{ title: '', quantity: 1, unit_label: meta.unit }]);
    setStages(getProjectStageTemplate(serviceType, { editingIncluded: false }));
    podcastEditingStage.current = null;
    setStageError('');
  };
  const setPodcastEditing = included => {
    set({ editing_included: included });
    setStages(current => {
      const editingIndex = current.findIndex(stage => stage.key === 'podcast_editing');
      if (!included) { podcastEditingStage.current = current.find(stage => stage.key === 'podcast_editing') || podcastEditingStage.current; return current.filter(stage => stage.key !== 'podcast_editing'); }
      if (editingIndex >= 0) return current;
      const templateStage = podcastEditingStage.current || getProjectStageTemplate('podcast').find(stage => stage.key === 'podcast_editing');
      const reviewIndex = current.findIndex(stage => stage.key === 'podcast_review');
      const next = [...current]; next.splice(reviewIndex < 0 ? next.length : reviewIndex, 0, templateStage); return next;
    });
  };
  const updateStage = (index, title) => setStages(values => values.map((stage, stageIndex) => stageIndex === index ? { ...stage, title } : stage));
  const moveStage = (index, direction) => setStages(values => { const target = index + direction; if (target < 0 || target >= values.length) return values; const next = [...values]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const deleteStage = index => {
    if (stages.length <= 2) return setStageError('يجب أن يحتوي المشروع على مرحلتين على الأقل.');
    setStages(values => values.filter((_, stageIndex) => stageIndex !== index)); setStageError('');
  };
  const addStage = () => { setStages(values => [...values, { key: `custom_${Date.now()}`, title: 'مرحلة جديدة', sort_order: values.length }]); setStageError(''); };
  const submit = event => {
    event.preventDefault();
    const normalizedStages = stages.map(stage => stage.title.trim()).filter(Boolean);
    if (normalizedStages.length < 2) { setStageError('أضف اسمًا واضحًا لمرحلتين على الأقل قبل إنشاء المشروع.'); return; }
    const visibleItems = items.filter(item => item.title.trim());
    const normalizedItems = visibleItems.map((item, index) => {
      const quantity = Number(item.quantity) || 1;
      const unitPrice = index === 0 ? (Number(form.agreed_price) || 0) / quantity : 0;
      return { description: item.title.trim(), quantity, unit: item.unit_label, unit_price: unitPrice, total_price: unitPrice * quantity, is_client_visible: true };
    });
    const requirements = {
      notes: form.requirements,
      ...(form.service_type === 'podcast' ? { editing_included: form.editing_included } : {}),
      ...(form.service_type === 'social_media' ? {
        platforms: form.platform_list.split(/[،,]/).map(value => value.trim()).filter(Boolean),
        platform_count: Number(form.platform_count) || 0, post_count: Number(form.post_count) || 0,
        video_count: Number(form.video_count) || 0, paid_ads: form.paid_ads, notes: form.social_notes,
      } : {}),
      ...(form.service_type === 'software' ? { platform: form.software_platform } : {}),
    };
    onSubmit({
      client_id: Number(form.client_id), service_type: form.service_type, name: form.name,
      starts_at: form.starts_at || new Date().toISOString().slice(0, 10), due_at: form.due_at || '',
      pricing_model: form.pricing_model, quantity: Number(form.quantity) || 1,
      unit_label: form.unit_label, agreed_price: Number(form.agreed_price) || 0,
      paid_amount: Number(form.paid_amount) || 0, requires_booking: canBook && form.requires_booking,
      requirements_json: requirements, items: normalizedItems,
      milestones: normalizedStages.map((title, index) => ({ title, status: 'pending', progress_percent: 0, is_client_visible: true, sort_order: index })),
      booking: canBook && form.requires_booking ? {
        date: form.booking_date, start_time: form.booking_start_time, end_time: form.booking_end_time,
        service: service.label, resource_id: null, status: 'pending', notes: form.service_type === 'reels' ? 'حجز استوديو فقط؛ المحاسبة بعدد الريلز.' : form.requirements,
      } : null,
    });
  };
  return <form className="custom-service-form" onSubmit={submit}>
    <span className="dialog-kicker">خدمة مخصصة جديدة</span>
    <h2 id="project-modal-title">حوّل الاتفاق إلى مسار تنفيذ واضح</h2>

    <fieldset className="custom-form-section">
      <legend><b>01</b><span>العميل ونوع الخدمة</span></legend>
      <div className="form-grid">
        <label>العميل<select required value={form.client_id} onChange={event => set({ client_id: event.target.value })}><option value="">اختر العميل</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label>نوع الخدمة<select value={form.service_type} onChange={event => setService(event.target.value)}>{Object.entries(CUSTOM_SERVICES).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label>
        <label className="wide-field">اسم المشروع<input required value={form.name} onChange={event => set({ name: event.target.value })} placeholder={`مثال: ${service.label} — إطلاق الصيف`}/></label>
        <label>تاريخ البداية<input type="date" value={form.starts_at} onChange={event => set({ starts_at: event.target.value })}/></label>
        <label>موعد التسليم<input type="date" min={form.starts_at || undefined} value={form.due_at} onChange={event => set({ due_at: event.target.value })}/></label>
      </div>
    </fieldset>

    <fieldset className="custom-form-section">
      <legend><b>02</b><span>تفاصيل {service.label}</span></legend>
      <div className="form-grid">
        {form.service_type === 'podcast' && <label className="wide-field form-check"><input type="checkbox" checked={form.editing_included} onChange={event => setPodcastEditing(event.target.checked)}/><span><strong>المونتاج ضمن الخدمة</strong><small>فعّلها إذا كان الاتفاق يشمل تحرير الحلقة بعد التصوير.</small></span></label>}
        {form.service_type === 'software' && <label>منصة التطبيق<select value={form.software_platform} onChange={event => set({ software_platform: event.target.value })}><option value="web">تطبيق ويب</option><option value="mobile">تطبيق موبايل</option><option value="desktop">تطبيق سطح مكتب</option></select></label>}
        {form.service_type === 'social_media' && <>
          <label className="wide-field">المنصات<input value={form.platform_list} onChange={event => set({ platform_list: event.target.value })} placeholder="Instagram، TikTok، Facebook"/></label>
          <label>عدد المنصات<input type="number" min="0" value={form.platform_count} onChange={event => set({ platform_count: event.target.value })}/></label>
          <label>المنشورات<input type="number" min="0" value={form.post_count} onChange={event => set({ post_count: event.target.value })}/></label>
          <label>الفيديوهات<input type="number" min="0" value={form.video_count} onChange={event => set({ video_count: event.target.value })}/></label>
          <label className="form-check"><input type="checkbox" checked={form.paid_ads} onChange={event => set({ paid_ads: event.target.checked })}/><span><strong>إدارة إعلانات مدفوعة</strong></span></label>
          <label className="wide-field">ملاحظات الباقة<textarea rows="2" value={form.social_notes} onChange={event => set({ social_notes: event.target.value })}/></label>
        </>}
        <label className="wide-field">المتطلبات ونطاق العمل<textarea rows="4" value={form.requirements} onChange={event => set({ requirements: event.target.value })} placeholder="اكتب المتطلبات، التجهيزات، أسلوب التسليم، وأي نقاط اتُفق عليها..."/></label>
      </div>
    </fieldset>

    <fieldset className="custom-form-section">
      <legend><b>03</b><span>مراحل إنتاج المشروع</span></legend>
      <div className="stage-template-heading"><p>هذا المسار مقترح بحسب نوع الخدمة. عدّله ليلائم اتفاق هذا العميل قبل الإنشاء.</p><span>{stages.length.toLocaleString('ar-EG')} مراحل</span></div>
      <div className="stage-template-editor">
        {stages.map((stage, index) => <div className="stage-template-row" key={stage.key}>
          <b>{(index + 1).toLocaleString('ar-EG')}</b>
          <input required aria-label={`اسم المرحلة ${index + 1}`} value={stage.title} onChange={event => updateStage(index, event.target.value)}/>
          <div className="stage-order-actions"><button type="button" disabled={index === 0} onClick={() => moveStage(index, -1)} aria-label={`تحريك ${stage.title} لأعلى`}><ArrowUp/></button><button type="button" disabled={index === stages.length - 1} onClick={() => moveStage(index, 1)} aria-label={`تحريك ${stage.title} لأسفل`}><ArrowDown/></button></div>
          <button type="button" className="stage-delete" disabled={stages.length <= 2} onClick={() => deleteStage(index)} aria-label={`حذف ${stage.title}`}><Trash2/></button>
        </div>)}
      </div>
      {stageError && <p className="stage-editor-error" role="alert">{stageError}</p>}
      <button type="button" className="add-stage-button" onClick={addStage}><Plus/> إضافة مرحلة</button>
    </fieldset>

    <fieldset className="custom-form-section">
      <legend><b>04</b><span>التسعير والكمية</span></legend>
      <div className="form-grid pricing-grid">
        <label>نموذج التسعير<select value={form.pricing_model} onChange={event => set({ pricing_model: event.target.value })}>{service.pricing.map(value => <option key={value} value={value}>{PRICING_LABELS[value] || value}</option>)}</select></label>
        <label>الكمية<input required type="number" min="1" step=".5" value={form.quantity} onChange={event => set({ quantity: event.target.value })}/></label>
        <label>اسم الوحدة<input required value={form.unit_label} onChange={event => set({ unit_label: event.target.value })}/></label>
        <label>السعر المتفق عليه<input required type="number" min="0" step=".01" value={form.agreed_price} onChange={event => set({ agreed_price: event.target.value })} placeholder="0.00"/></label>
        <label>المدفوع مبدئيًا<input type="number" min="0" step=".01" max={form.agreed_price || undefined} value={form.paid_amount} onChange={event => set({ paid_amount: event.target.value })}/></label>
      </div>
      {form.service_type === 'reels' && <p className="custom-form-callout"><CalendarClock/> الموعد — إن وُجد — يحجز الاستوديو فقط. قيمة المشروع تُحسب بعدد الريلز، لا بعدد ساعات التصوير.</p>}
    </fieldset>

    {canBook && <fieldset className="custom-form-section booking-section">
      <legend><b>05</b><span>موعد مرتبط (اختياري)</span></legend>
      <label className="form-check booking-toggle"><input type="checkbox" checked={form.requires_booking} onChange={event => set({ requires_booking: event.target.checked })}/><span><strong>هذه الخدمة تحتاج موعدًا محجوزًا</strong><small>سيظهر الموعد داخل رحلة المشروع ولدى العميل.</small></span></label>
      {form.requires_booking && <div className="form-grid booking-fields"><label>التاريخ (يوم/شهر/سنة)<input required type="date" value={form.booking_date} onChange={event => set({ booking_date: event.target.value })}/></label><label>من<BusinessTimeSelect required min="12:00" max="23:00" value={form.booking_start_time} onChange={event => set({ booking_start_time: event.target.value })}/></label><label>إلى<BusinessTimeSelect required min="13:00" max="24:00" value={form.booking_end_time} onChange={event => set({ booking_end_time: event.target.value })}/></label></div>}
    </fieldset>}

    <fieldset className="custom-form-section">
      <legend><b>{canBook ? '06' : '05'}</b><span>بنود التسليم الأولية</span></legend>
      <div className="starter-items">
        {items.map((item, index) => <div key={index} className="starter-item"><input value={item.title} onChange={event => setItems(values => values.map((value, itemIndex) => itemIndex === index ? { ...value, title: event.target.value } : value))} placeholder="مثال: فيديو النسخة النهائية"/><input aria-label="الكمية" type="number" min="1" value={item.quantity} onChange={event => setItems(values => values.map((value, itemIndex) => itemIndex === index ? { ...value, quantity: event.target.value } : value))}/><input aria-label="الوحدة" value={item.unit_label} onChange={event => setItems(values => values.map((value, itemIndex) => itemIndex === index ? { ...value, unit_label: event.target.value } : value))}/>{items.length > 1 && <button type="button" onClick={() => setItems(values => values.filter((_, itemIndex) => itemIndex !== index))} aria-label="حذف البند"><Trash2/></button>}</div>)}
        <button type="button" className="add-starter-item" onClick={() => setItems(values => [...values, { title: '', quantity: 1, unit_label: service.unit }])}><Plus/> إضافة بند تسليم</button>
      </div>
    </fieldset>

    <footer className="custom-form-footer"><span><Check/> يمكنك إضافة المراحل والمهام والمحتوى من تفاصيل المشروع لاحقًا.</span><button className="dialog-submit" disabled={busy}>{busy ? <RefreshCw className="spin"/> : <Plus/>}{busy ? 'جارٍ إنشاء المشروع...' : 'إنشاء الخدمة المخصصة'}</button></footer>
  </form>;
}
