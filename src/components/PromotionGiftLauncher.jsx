import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock3, Gift, Sparkles, X } from 'lucide-react';
import useModalDialog from '../hooks/useModalDialog';
import { formatEGP } from '../lib/businessFormat';
import { cairoDateTimeToEpoch } from '../lib/promotionTime';
import { activeGiftPromotions, promotionGiftPrice } from '../lib/promotionGift';
import './PromotionGiftLauncher.css';

const expiryFormat = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

function GiftDialog({ promotion, count, index, onStep, onClose, onAction, triggerRef, registration }) {
  const titleId = useId();
  const dialogRef = useModalDialog(true, onClose, { returnFocusRef: triggerRef, isolateBackground: true });
  const price = promotionGiftPrice(promotion.promotional_price);
  const original = promotionGiftPrice(promotion.original_price);
  const act = () => {
    onClose();
    // Let the modal restore its trigger first, then move to the chosen destination.
    window.requestAnimationFrame(() => window.requestAnimationFrame(onAction));
  };
  return createPortal(
    <div className="promotion-gift-overlay" dir="rtl" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="promotion-gift-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="promotion-gift-header">
          <button type="button" className="promotion-gift-close" onClick={onClose} aria-label="إغلاق العرض" data-dialog-initial><X aria-hidden="true"/></button>
          <span className="promotion-gift-emblem" aria-hidden="true"><Gift/><Sparkles/></span>
          <span className="promotion-gift-eyebrow">{promotion.badge || 'عرض مميز ليك'}</span>
          <h2 id={titleId}>{promotion.public_title}</h2>
        </header>
        <div className="promotion-gift-content">
          {count > 1 && <nav className="promotion-gift-carousel" aria-label="تصفح العروض"><button type="button" onClick={() => onStep(-1)} aria-label="العرض السابق"><ChevronRight aria-hidden="true"/></button><span aria-live="polite">عرض {index + 1} من {count}</span><button type="button" onClick={() => onStep(1)} aria-label="العرض التالي"><ChevronLeft aria-hidden="true"/></button></nav>}
          {promotion.description && <p className="promotion-gift-description">{promotion.description}</p>}
          {(price !== null || promotion.discount_text) && <div className="promotion-gift-value">
            {price !== null && <div><span>سعر العرض</span><strong>{formatEGP(price)}</strong>{original !== null && original > price && <del aria-label={`السعر السابق ${formatEGP(original)}`}>{formatEGP(original)}</del>}</div>}
            {promotion.discount_text && <span className="promotion-gift-saving">{promotion.discount_text}</span>}
          </div>}
          <p className="promotion-gift-expiry"><Clock3 aria-hidden="true"/><span>متاح لحد <time dateTime={new Date(cairoDateTimeToEpoch(promotion.ends_at)).toISOString()}>{expiryFormat.format(cairoDateTimeToEpoch(promotion.ends_at))}</time><small>بتوقيت القاهرة</small></span></p>
          {promotion.terms && <div className="promotion-gift-terms"><strong>شروط العرض</strong><p>{promotion.terms}</p></div>}
          <button type="button" className="promotion-gift-action" onClick={act}>{registration ? 'كمّل تسجيلك وشوف العرض في حسابك' : 'عرض التفاصيل والاشتراك'}<ArrowLeft aria-hidden="true"/></button>
          <p className="promotion-gift-note">{registration ? <>بعد التسجيل، هتلاقي العرض في زر <strong>العروض</strong> داخل حسابك خلال فترة سريانه.</> : <>هتلاقي العرض دايمًا في قسم <strong>العروض</strong> خلال فترة سريانه.</>}</p>
        </div>
      </section>
    </div>, document.body,
  );
}

export default function PromotionGiftLauncher({ promotions, serverOffset = 0, registration = false, onAction }) {
  const [clock, setClock] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [editing, setEditing] = useState(false);
  const triggerRef = useRef(null);
  useEffect(() => {
    const update = () => setClock(Date.now());
    const timer = window.setInterval(update, 1000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  useEffect(() => {
    if (!registration) return undefined;
    const update = () => setEditing(Boolean(document.activeElement?.closest('.registration-page input, .registration-page textarea, .registration-page select, .registration-page [contenteditable="true"]')));
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => { document.removeEventListener('focusin', update); document.removeEventListener('focusout', update); };
  }, [registration]);
  const items = useMemo(() => activeGiftPromotions(promotions, clock + serverOffset), [promotions, clock, serverOffset]);
  useEffect(() => {
    // A refreshed/expired campaign must not leave a latent open state for a later offer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!items.length) setOpen(false);
  }, [items.length]);
  const index = Math.max(0, items.findIndex(item => String(item.id) === String(activeId)));
  const promotion = items[index];
  if (!promotion) return null;
  const step = direction => setActiveId(items[(index + direction + items.length) % items.length].id);
  return <>
    <div className={`promotion-gift-space${registration ? ' promotion-gift-space--registration' : ''}`} aria-hidden="true"/>
    <button ref={triggerRef} type="button" className={`promotion-gift-launcher${registration ? ' promotion-gift-launcher--registration' : ''}`} hidden={open || editing} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="عرض مميز مستنيك، افتح وشوف العرض">
      <span className="promotion-gift-box" aria-hidden="true"><Gift/><Sparkles/></span>
      <span className="promotion-gift-launcher-copy"><strong>عرض مميز مستنيك</strong><span>افتح وشوف العرض <ArrowLeft aria-hidden="true"/></span></span>
    </button>
    {open && <GiftDialog promotion={promotion} count={items.length} index={index} onStep={step} onClose={() => setOpen(false)} onAction={onAction} triggerRef={triggerRef} registration={registration}/>}
  </>;
}
