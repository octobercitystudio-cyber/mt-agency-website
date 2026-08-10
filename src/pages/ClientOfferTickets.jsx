import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Eye, FileText, Hourglass, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { formatBookingDate, formatEGP } from '../lib/businessFormat';
import { millisecondsToNextSecond } from '../lib/promotionCountdown';
import { clientOfferCountdown, clientOfferDiscount, clientOfferIsActionable, clientOfferRuntimeStatus, clientOfferSummary, orderClientOffers } from '../lib/clientOfferAdapter';
import './ClientOfferTickets.css';

const stateMeta = {
  sent: { label: 'متاح الآن', icon: Hourglass }, accepted: { label: 'تم القبول', icon: CheckCircle2 },
  expired: { label: 'منتهي', icon: Clock3 }, cancelled: { label: 'ملغي', icon: XCircle },
};
const unitLabel = unit => ({ hour: 'ساعة', reel: 'ريل', day: 'يوم', month: 'شهر', project: 'مشروع' })[unit] || 'وحدة';

function useOfferClock() {
  // A clock snapshot is the intentional external input for this timer hook.
  // eslint-disable-next-line react-hooks/purity
  const [now, setNow] = useState(Date.now());
  useEffect(() => { let interval; const timeout = window.setTimeout(() => { setNow(Date.now()); interval = window.setInterval(() => setNow(Date.now()), 1000); }, millisecondsToNextSecond(Date.now())); return () => { window.clearTimeout(timeout); window.clearInterval(interval); }; }, []);
  return now;
}

export function ClientOfferCountdown({ offer, now, serverOffset, compact = false }) {
  const parts = clientOfferCountdown(offer, now, serverOffset); if (!parts) return null;
  const stableLabel = `ينتهي العرض خلال ${Number(parts[0].value)} يوم و${Number(parts[1].value)} ساعة و${Number(parts[2].value)} دقيقة`;
  return <div className={`client-ticket-countdown${compact ? ' is-compact' : ''}`} aria-label={stableLabel} aria-live="off">{parts.map(part => <span key={part.unit}><strong>{part.value}</strong><small>{part.label}</small></span>)}</div>;
}

function OfferSeal({ status }) { const meta = stateMeta[status] || stateMeta.cancelled; const Icon = meta.icon; return <span className={`client-ticket-seal is-${status}`}><Icon/>{meta.label}</span>; }

function OfferTicket({ offer, now, serverOffset, onView }) {
  const status = clientOfferRuntimeStatus(offer, now, serverOffset); const discount = clientOfferDiscount(offer);
  return <article className={`client-offer-ticket is-${status}`} data-offer-id={offer.id}>
    <div className="client-offer-ticket__foil" aria-hidden="true"/><header><span className="client-offer-ticket__exclusive"><Sparkles/> عرض خاص</span><OfferSeal status={status}/></header>
    <p className="client-offer-ticket__reference">{offer.offer_number}</p><h3>{offer.title}</h3>{offer.notes && <p className="client-offer-ticket__notes">{offer.notes}</p>}
    <div className="client-offer-ticket__price">{discount.amount > 0 && <del>{formatEGP(offer.subtotal)}</del>}<strong>{formatEGP(offer.total)}</strong>{discount.amount > 0 && <span>وفّرت {formatEGP(discount.amount)}{discount.percentage ? ` · ${discount.percentage}%` : ''}</span>}</div>
    <div className="client-offer-ticket__expiry"><Clock3/>{offer.valid_until ? <>صالح حتى {formatBookingDate(offer.valid_until)}</> : <>بدون تاريخ انتهاء</>}</div>
    <ClientOfferCountdown offer={offer} now={now} serverOffset={serverOffset} compact/>
    <div className="client-offer-ticket__items"><FileText/><span>{offer.item_count} بند</span><p>{offer.item_preview.join(' · ') || 'تفاصيل العرض متاحة للمراجعة'}</p></div>
    <button type="button" onClick={event => onView(event, { ...offer, effective_status: status })}><Eye/> {status === 'sent' ? 'عرض التفاصيل والقبول' : 'عرض تفاصيل العرض'}</button>
  </article>;
}

export default function ClientOfferTickets({ offers, serverOffset = 0, onView, loading = false, error = '' }) {
  const now = useOfferClock();
  const visibleOffers = useMemo(() => orderClientOffers(offers.map(offer => ({ ...offer, effective_status: clientOfferRuntimeStatus(offer, now, serverOffset) }))), [offers, now, serverOffset]);
  const summary = clientOfferSummary(visibleOffers);
  if (loading) return <div className="client-offer-state" role="status"><Hourglass/><h3>جارٍ تجهيز عروضك</h3><p>نراجع الأسعار ومدة الصلاحية الآن.</p></div>;
  if (error) return <div className="client-offer-state is-error" role="alert"><XCircle/><h3>تعذر تحميل العروض</h3><p>{error}</p></div>;
  return <section className="client-offer-space" aria-label="العروض الخاصة">
    <div className="client-offer-summary"><article><strong>{summary.available}</strong><span>متاح الآن</span></article><article><strong>{summary.accepted}</strong><span>تم قبولها</span></article><article><strong>{summary.closed}</strong><span>منتهية أو ملغاة</span></article></div>
    <div className="client-offer-ticket-grid">{visibleOffers.map(offer => <OfferTicket key={offer.id} offer={offer} now={now} serverOffset={serverOffset} onView={onView}/>)}</div>
    {!visibleOffers.length && <div className="client-offer-state"><ShieldCheck/><h3>لا توجد عروض خاصة حاليًا</h3><p>سيظهر هنا فقط العرض الذي يرسله المالك إلى حسابك.</p></div>}
  </section>;
}

export function ClientOfferDetails({ offer, serverOffset = 0, busy, confirm, onConfirm, onCancelConfirm, onAccept }) {
  const now = useOfferClock(); const status = clientOfferRuntimeStatus(offer, now, serverOffset); const isActionable = clientOfferIsActionable(offer, now, serverOffset); const discount = clientOfferDiscount(offer);
  return <div className="client-ticket-detail"><header><span><Sparkles/> عرض خاص · {offer.offer_number}</span><OfferSeal status={status}/></header><h2 id="client-offer-title">{offer.title}</h2>
    <div className="client-ticket-detail__expiry"><Clock3/>{offer.valid_until ? `صالح حتى ${formatBookingDate(offer.valid_until)}` : 'بدون تاريخ انتهاء'}</div><ClientOfferCountdown offer={offer} now={now} serverOffset={serverOffset}/>
    <div className="client-ticket-detail__items">{offer.items?.map(item => <article key={item.id}><div><strong>{item.description}</strong><span data-label="الكمية">{item.quantity.toLocaleString('ar-EG')} {unitLabel(item.unit)}</span></div><span data-label="سعر الوحدة">{formatEGP(item.unit_price)}</span><b data-label="الإجمالي">{formatEGP(item.total)}</b></article>)}</div>
    <dl className="client-ticket-detail__totals"><div><dt>الإجمالي الفرعي</dt><dd>{formatEGP(offer.subtotal)}</dd></div>{discount.amount > 0 && <div><dt>الخصم{discount.percentage ? ` (${discount.percentage}%)` : ''}</dt><dd>- {formatEGP(discount.amount)}</dd></div>}<div><dt>القيمة النهائية</dt><dd>{formatEGP(offer.total)}</dd></div></dl>
    {offer.notes && <p className="client-ticket-detail__notes">{offer.notes}</p>}
    {isActionable ? <section className="client-ticket-accept"><p><ShieldCheck/> بقبول العرض سيتم إنشاء الفاتورة والخدمات المرتبطة مرة واحدة فقط.</p>{confirm ? <div><button type="button" onClick={onCancelConfirm} disabled={busy}>تراجع</button><button type="button" className="client-primary" onClick={onAccept} disabled={busy}>{busy ? <Hourglass/> : <CheckCircle2/>}{busy ? 'جارٍ اعتماد القبول...' : 'نعم، أؤكد القبول'}</button></div> : <button type="button" className="client-primary" onClick={onConfirm}><CheckCircle2/> قبول العرض</button>}</section> : <div className={`client-ticket-decision is-${status}`}><OfferSeal status={status}/><span>{status === 'accepted' ? 'تم اعتماد هذا العرض سابقًا.' : status === 'expired' ? 'انتهت مدة قبول هذا العرض.' : 'ألغت الإدارة هذا العرض.'}</span></div>}
  </div>;
}
