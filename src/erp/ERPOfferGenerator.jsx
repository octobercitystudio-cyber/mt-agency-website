import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Check, Eye, FileCheck2, FilePlus2, FileText, Plus, Printer, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useData } from '../store/DataContext';
import './ERPOfferGenerator.css';

const defaultValidity = () => { const date = new Date(); date.setDate(date.getDate() + 15); return date.toISOString().slice(0, 10); };
const emptyForm = () => ({ client_id: '', title: 'عرض خدمات MT Agency', valid_until: defaultValidity(), discount: 0, notes: '', items: [] });
const STATUS = { draft: ['مسودة','draft'], sent: ['مرسل للعميل','sent'], accepted: ['مقبول','accepted'], expired: ['منتهي','expired'] };
const money = value => `${Number(value || 0).toLocaleString('ar-EG')} ج`;
const unitName = unit => ({ hour:'ساعة', reel:'ريل', day:'يوم', month:'شهر', project:'مشروع' })[unit] || unit;
const arabicDate = value => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(date);
};

export default function ERPOfferGenerator() {
  const { currentUser } = useData();
  const canCompose = ['owner','admin','operations'].includes(currentUser?.role);
  const [offers, setOffers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [mode, setMode] = useState(canCompose ? 'offers' : 'invoices');
  const [form, setForm] = useState(emptyForm);
  const [selectedService, setSelectedService] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRef = useRef(null);
  const detailTrigger = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    const [offersResult,invoicesResult,clientsResult,servicesResult] = await Promise.all([
      supabase.from('offers').select('*').order('created_at',{ascending:false}),
      supabase.from('invoices').select('*').order('issued_at',{ascending:false}),
      supabase.from('clients').select('id,name,phone1').order('name',{ascending:true}),
      supabase.from('services').select('*').eq('is_active',1).order('name',{ascending:true}),
    ]);
    const failed=[offersResult,invoicesResult,clientsResult,servicesResult].find(result=>result.error);
    if(failed?.error)setError(failed.error.message||'تعذر تحميل العروض والفواتير.');
    else{setOffers(offersResult.data||[]);setInvoices(invoicesResult.data||[]);setClients(clientsResult.data||[]);setServices(servicesResult.data||[])}
    setLoading(false);
  },[]);
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  },[fetchData]);

  const subtotal=useMemo(()=>form.items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.unit_price),0),[form.items]);
  const finalDiscount=Math.min(subtotal,Math.max(0,Number(form.discount||0)));
  const total=subtotal-finalDiscount;
  const clientName=id=>clients.find(client=>Number(client.id)===Number(id))?.name||'عميل';
  const metrics={draft:offers.filter(item=>item.status==='draft').length,sent:offers.filter(item=>item.status==='sent').length,accepted:offers.filter(item=>item.status==='accepted').length,value:offers.reduce((sum,item)=>sum+Number(item.total),0)};
  const invoiceMetrics={count:invoices.length,issued:invoices.filter(item=>item.status!=='paid').length,value:invoices.reduce((sum,item)=>sum+Number(item.total),0),due:invoices.reduce((sum,item)=>sum+Math.max(0,Number(item.total)-Number(item.paid_amount)),0)};

  const addService=()=>{const service=services.find(item=>String(item.id)===selectedService);if(!service)return;setForm(prev=>({...prev,items:[...prev.items,{key:crypto.randomUUID(),service_id:service.id,description:service.name,quantity:1,unit:service.billing_unit||'project',unit_price:Number(service.price||0)}]}));setSelectedService('')};
  const updateItem=(key,field,value)=>setForm(prev=>({...prev,items:prev.items.map(item=>item.key===key?{...item,[field]:value}:item)}));
  const removeItem=key=>setForm(prev=>({...prev,items:prev.items.filter(item=>item.key!==key)}));

  const saveDraft=async event=>{event.preventDefault();if(!form.items.length)return setError('أضف بند خدمة واحدًا على الأقل.');setBusy('save');setError('');const{error:requestError}=await supabase.request('/offers',{method:'POST',body:JSON.stringify({...form,client_id:Number(form.client_id),discount:finalDiscount,items:form.items.map(item=>({service_id:item.service_id,description:item.description,quantity:Number(item.quantity),unit:item.unit,unit_price:Number(item.unit_price)}))})});setBusy('');if(requestError)return setError(requestError.message||'تعذر حفظ العرض.');setForm(emptyForm());setNotice('تم حفظ عرض السعر كمسودة. يمكنك إرساله من سجل العروض.');setMode('offers');await fetchData()};
  const sendOffer=async offer=>{if(!canCompose)return;if(!window.confirm(`إرسال العرض ${offer.offer_number} للعميل؟`))return;setBusy(`send-${offer.id}`);const{error:requestError}=await supabase.request(`/offers/${offer.id}/send`,{method:'POST',body:'{}'});setBusy('');if(requestError)return setError(requestError.message||'تعذر إرسال العرض.');setNotice('تم إرسال العرض إلى بوابة العميل.');await fetchData()};
  const viewOffer=async(event,offer)=>{detailTrigger.current=event.currentTarget;setDetailLoading(true);setDetail({id:offer.id});const{data,error:requestError}=await supabase.request(`/offers/${offer.id}`,{method:'GET'});setDetailLoading(false);if(requestError){setDetail(null);return setError(requestError.message||'تعذر تحميل تفاصيل العرض.')}setDetail(data)};
  const closeDetail=useCallback(()=>setDetail(null),[]);
  useEffect(()=>{if(!detail)return undefined;const dialog=detailRef.current;const focusables=()=>Array.from(dialog?.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')||[]);const onKey=event=>{if(event.key==='Escape'){event.preventDefault();closeDetail()}else if(event.key==='Tab'){const items=focusables();if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}};document.addEventListener('keydown',onKey);document.body.style.overflow='hidden';requestAnimationFrame(()=>focusables()[0]?.focus());return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow='';requestAnimationFrame(()=>detailTrigger.current?.focus())}},[detail,closeDetail]);

  return <div className="offers-command" dir="rtl">
    <header className="offers-command-head"><div><span><FileCheck2/> {canCompose?'مسار المبيعات':'المتابعة المالية'}</span><h2>{canCompose?'العروض والفواتير':'الفواتير'}</h2><p>{canCompose?'أنشئ العرض، احفظه، ثم أرسله للعميل ليقبله من بوابته.':'تابع الفواتير الصادرة والمدفوعات والأرصدة المتبقية.'}</p></div>{canCompose&&<button onClick={()=>setMode('compose')}><FilePlus2/> عرض جديد</button>}</header>
    <section className="offers-metrics">{canCompose?<><Metric label="مسودات" value={metrics.draft}/><Metric label="بانتظار العميل" value={metrics.sent} tone="amber"/><Metric label="عروض مقبولة" value={metrics.accepted} tone="green"/><Metric label="قيمة العروض" value={money(metrics.value)} tone="cyan"/></>:<><Metric label="عدد الفواتير" value={invoiceMetrics.count}/><Metric label="فواتير صادرة" value={invoiceMetrics.issued} tone="amber"/><Metric label="إجمالي الفواتير" value={money(invoiceMetrics.value)} tone="green"/><Metric label="الرصيد المتبقي" value={money(invoiceMetrics.due)} tone="cyan"/></>}</section>
    {notice&&<div className="offer-feedback success"><Check/> {notice}</div>}{error&&<div className="offer-feedback error"><X/><span>{error}</span><button onClick={()=>setError('')}>إخفاء</button></div>}
    <nav className="offers-modes">{canCompose&&<><button className={mode==='compose'?'active':''} onClick={()=>setMode('compose')}><FilePlus2/> تركيب عرض</button><button className={mode==='offers'?'active':''} onClick={()=>setMode('offers')}><FileText/> سجل العروض <span>{offers.length}</span></button></>}<button className={mode==='invoices'?'active':''} onClick={()=>setMode('invoices')}><Banknote/> الفواتير <span>{invoices.length}</span></button><button className="refresh" onClick={fetchData}><RefreshCw className={loading?'offer-spin':''}/> تحديث</button></nav>

    {loading?<Empty icon={RefreshCw} spin title="جارٍ تجهيز مساحة المبيعات" text="نسترجع العروض والفواتير من الخادم."/>:mode==='compose'&&canCompose?<form className="offer-composer" onSubmit={saveDraft}><section className="offer-fields"><div className="offer-section-title"><span>01</span><div><h3>بيانات العرض</h3><p>حدد العميل والعنوان ومدة الصلاحية.</p></div></div><div className="offer-field-grid"><label>العميل<select required value={form.client_id} onChange={event=>setForm({...form,client_id:event.target.value})}><option value="">اختر العميل</option>{clients.map(client=><option value={client.id} key={client.id}>{client.name} — {client.phone1}</option>)}</select></label><label>عنوان العرض<input required value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></label><label>صالح حتى<input required type="date" min={new Date().toISOString().slice(0,10)} value={form.valid_until} onChange={event=>setForm({...form,valid_until:event.target.value})}/></label><label>خصم بالقيمة<input type="number" min="0" max={subtotal} value={form.discount} onChange={event=>setForm({...form,discount:event.target.value})}/></label></div><label>ملاحظات وشروط<textarea rows="3" value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})} placeholder="شروط الدفع، مدة التنفيذ، وما يشمله العرض..."/></label></section><section className="offer-lines"><div className="offer-section-title"><span>02</span><div><h3>بناء الباقة التجارية</h3><p>أضف الخدمات واضبط الوصف والكمية والسعر.</p></div></div><div className="offer-add-service"><select value={selectedService} onChange={event=>setSelectedService(event.target.value)}><option value="">اختر خدمة من النظام</option>{services.map(service=><option value={service.id} key={service.id}>{service.name} — {money(service.price)}</option>)}</select><button type="button" disabled={!selectedService} onClick={addService}><Plus/> إضافة بند</button></div><div className="offer-line-stack">{form.items.map((item,index)=><article key={item.key}><div className="offer-line-index">{String(index+1).padStart(2,'0')}</div><label className="description">الوصف<input value={item.description} onChange={event=>updateItem(item.key,'description',event.target.value)}/></label><label>الكمية<input type="number" min=".25" step=".25" value={item.quantity} onChange={event=>updateItem(item.key,'quantity',event.target.value)}/></label><label>الوحدة<select value={item.unit} onChange={event=>updateItem(item.key,'unit',event.target.value)}><option value="hour">ساعة</option><option value="reel">ريل</option><option value="day">يوم</option><option value="month">شهر</option><option value="project">مشروع</option></select></label><label>سعر الوحدة<input type="number" min="0" value={item.unit_price} onChange={event=>updateItem(item.key,'unit_price',event.target.value)}/></label><strong>{money(Number(item.quantity)*Number(item.unit_price))}</strong><button type="button" aria-label={`حذف بند ${item.description}`} onClick={()=>removeItem(item.key)}><Trash2/></button></article>)}{!form.items.length&&<div className="offer-lines-empty"><Plus/><p>أضف أول خدمة لتبدأ تركيب العرض.</p></div>}</div></section><aside className="offer-total-strip"><div><span>الإجمالي الفرعي</span><strong>{money(subtotal)}</strong></div><div><span>الخصم</span><strong>- {money(finalDiscount)}</strong></div><div className="grand"><span>قيمة العرض النهائية</span><strong>{money(total)}</strong></div><button disabled={busy==='save'||!form.items.length}><FileCheck2/>{busy==='save'?'جارٍ الحفظ...':'حفظ كمسودة'}</button><small>بعد الحفظ يمكنك مراجعته وإرساله للعميل.</small></aside></form>:mode==='offers'?<OfferList offers={offers} clients={clients} busy={busy} onView={viewOffer} onSend={sendOffer}/>:<InvoiceList invoices={invoices} clients={clients}/>}

    {detail&&<div className="offer-modal" onMouseDown={event=>{if(event.target===event.currentTarget)closeDetail()}}><section ref={detailRef} role="dialog" aria-modal="true" aria-labelledby="offer-detail-title" className="offer-dialog"><button className="offer-dialog-close" onClick={closeDetail} aria-label="إغلاق تفاصيل العرض"><X/></button>{detailLoading?<Empty icon={RefreshCw} spin title="جارٍ تحميل العرض" text=""/>:<><div className="offer-detail-head"><span>{detail.offer_number}</span><h3 id="offer-detail-title">{detail.title}</h3><p>{clientName(detail.client_id)} · صالح حتى {detail.valid_until||'غير محدد'}</p></div><div className="offer-detail-lines">{detail.items?.map(item=><article key={item.id}><div><strong>{item.description}</strong><span>{Number(item.quantity)} {unitName(item.unit)} × {money(item.unit_price)}</span></div><b>{money(item.total)}</b></article>)}</div><div className="offer-detail-totals"><span>الإجمالي الفرعي <b>{money(detail.subtotal)}</b></span><span>الخصم <b>{money(detail.discount)}</b></span><strong>الإجمالي <b>{money(detail.total)}</b></strong></div>{detail.notes&&<p className="offer-detail-note">{detail.notes}</p>}<button className="offer-print" onClick={()=>window.print()}><Printer/> طباعة / حفظ PDF</button></>}</section></div>}
  </div>;
}

function Metric({label,value,tone=''}){return <article className={tone}><span>{label}</span><strong>{value}</strong></article>}
function Status({value}){const meta=STATUS[value]||[value,value];return <span className={`offer-status ${meta[1]}`}>{meta[0]}</span>}
function OfferList({offers,clients,busy,onView,onSend}){const{currentUser}=useData();const canSend=['owner','admin','operations'].includes(currentUser?.role);const name=id=>clients.find(client=>Number(client.id)===Number(id))?.name||'عميل';if(!offers.length)return <Empty icon={FileText} title="لا توجد عروض محفوظة" text="ابدأ بتركيب أول عرض تجاري للعميل."/>;return <div className="offer-table-wrap"><table><thead><tr><th>رقم العرض</th><th>العميل والعنوان</th><th>القيمة</th><th>الصلاحية</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{offers.map(offer=><tr key={offer.id}><td><b>{offer.offer_number}</b><span>{arabicDate(offer.created_at)}</span></td><td><strong>{name(offer.client_id)}</strong><span>{offer.title}</span></td><td><strong>{money(offer.total)}</strong></td><td>{arabicDate(offer.valid_until)}</td><td><Status value={offer.status}/></td><td><div className="offer-row-actions"><button onClick={event=>onView(event,offer)}><Eye/> عرض</button>{canSend&&offer.status==='draft'&&<button className="send" disabled={busy===`send-${offer.id}`} onClick={()=>onSend(offer)}><Send/> {busy===`send-${offer.id}`?'جارٍ...':'إرسال'}</button>}</div></td></tr>)}</tbody></table></div>}
function InvoiceList({invoices,clients}){const name=id=>clients.find(client=>Number(client.id)===Number(id))?.name||'عميل';if(!invoices.length)return <Empty icon={Banknote} title="لا توجد فواتير بعد" text="تُنشأ الفاتورة تلقائيًا عند قبول عرض السعر."/>;return <div className="invoice-grid">{invoices.map(invoice=>{const due=Math.max(0,Number(invoice.total)-Number(invoice.paid_amount));return <article key={invoice.id}><header><div><span>{invoice.invoice_number}</span><h3>{name(invoice.client_id)}</h3></div><Status value={invoice.status}/></header><div className="invoice-value"><span>الإجمالي</span><strong>{money(invoice.total)}</strong></div><dl><div><dt>مدفوع</dt><dd>{money(invoice.paid_amount)}</dd></div><div><dt>متبقي</dt><dd className={due?'due':''}>{money(due)}</dd></div><div><dt>الإصدار</dt><dd>{arabicDate(invoice.issued_at)}</dd></div><div><dt>الاستحقاق</dt><dd>{arabicDate(invoice.due_at)}</dd></div></dl></article>})}</div>}
function Empty({icon:Icon,title,text,spin}){return <div className="offer-empty"><Icon className={spin?'offer-spin':''}/><h3>{title}</h3>{text&&<p>{text}</p>}</div>}
