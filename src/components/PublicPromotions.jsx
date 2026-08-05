import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatEGP } from '../lib/businessFormat';
import { promotionApi } from '../lib/promotionApi';
import { cairoDateTimeToEpoch } from '../lib/promotionTime';
import './PublicPromotions.css';

const storageKey = promotion => `mt-promo:${promotion.id}:v${promotion.version}:${promotion.ends_at}`;
const bannerStorageKey = promotion => `${storageKey(promotion)}:banner`;
const dismissed = promotion => {
  try { return sessionStorage.getItem(storageKey(promotion)) === 'dismissed'; }
  catch { return false; }
};
const bannerDismissed = promotion => {
  try { return sessionStorage.getItem(bannerStorageKey(promotion)) === 'dismissed'; }
  catch { return false; }
};

const PROMO_COPY = {
  ar: { day: 'يوم', hour: 'ساعة', minute: 'دقيقة', second: 'ثانية', remaining: 'الوقت المتبقي للعرض', endsIn: 'ينتهي خلال', close: 'إغلاق نافذة العرض', closeBanner: 'إغلاق شريط العرض', kicker: 'عرض حصري ينتهي قريبًا', value: 'قيمة العرض', note: 'يُطبق العرض خلال الفترة المحددة وحسب توافر الخدمة.', dialogBadge: 'لفترة محدودة', bannerBadge: 'عرض حصري', bannerLabel: 'عرض حصري متاح الآن', now: 'الآن' },
  en: { day: 'day', hour: 'hour', minute: 'minute', second: 'second', remaining: 'Time remaining for this offer', endsIn: 'Ends in', close: 'Close offer dialog', closeBanner: 'Close offer banner', kicker: 'Exclusive offer ending soon', value: 'Offer value', note: 'Offer applies during the stated period and is subject to service availability.', dialogBadge: 'Limited time', bannerBadge: 'Exclusive offer', bannerLabel: 'Exclusive offer available now', now: 'Now' },
};

const countdown = (milliseconds, copy) => {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pairs = days > 0 ? [[days, copy.day], [hours, copy.hour], [minutes, copy.minute]] : [[hours, copy.hour], [minutes, copy.minute], [seconds, copy.second]];
  return pairs.map(([value, label]) => ({ value: String(value).padStart(2, '0'), label }));
};

const englishEGP = new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });
const textDirection = value => /[\u0600-\u06ff]/.test(String(value || '')) ? 'rtl' : 'ltr';
const localizedField = (promotion, field, isEnglish) => {
  const english = String(promotion[`${field}_en`] || '').trim();
  const value = isEnglish && english ? english : promotion[field];
  return { value, dir: textDirection(value) };
};
const promotionContent = (promotion, isEnglish) => {
  const discount = localizedField(promotion, 'discount_text', isEnglish);
  const value = promotion.promotional_price !== null
    ? { value: isEnglish ? englishEGP.format(Number(promotion.promotional_price) || 0) : formatEGP(promotion.promotional_price), dir: 'ltr' }
    : discount;
  return {
    title: localizedField(promotion, 'public_title', isEnglish),
    badge: localizedField(promotion, 'badge', isEnglish),
    description: localizedField(promotion, 'description', isEnglish),
    cta: localizedField(promotion, 'cta_label', isEnglish),
    value,
    originalPrice: promotion.original_price === null ? null : (isEnglish ? englishEGP.format(Number(promotion.original_price) || 0) : formatEGP(promotion.original_price)),
  };
};

const safeExternal = url => /^https?:\/\//i.test(url || '');

export default function PublicPromotions() {
  const { i18n } = useTranslation();
  const isEnglish = String(i18n.resolvedLanguage || i18n.language).startsWith('en');
  const [promotions, setPromotions] = useState([]);
  const [tick, setTick] = useState(0);
  const [dismissEpoch, setDismissEpoch] = useState(0);
  const [, setBannerDismissEpoch] = useState(0);
  const clockOffset = useRef(0);
  const bannerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    promotionApi.public(controller.signal).then(result => {
      clockOffset.current = result?.server_now ? new Date(result.server_now).getTime() - Date.now() : 0;
      setPromotions(Array.isArray(result?.items) ? result.items : []);
      setTick(Date.now() + clockOffset.current);
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!promotions.length) return undefined;
    const timer = window.setInterval(() => setTick(Date.now() + clockOffset.current), 1000);
    return () => window.clearInterval(timer);
  }, [promotions.length]);

  const active = useMemo(() => promotions
    .filter(promotion => cairoDateTimeToEpoch(promotion.starts_at) <= tick && cairoDateTimeToEpoch(promotion.ends_at) > tick)
    .sort((a, b) => Number(b.priority) - Number(a.priority)), [promotions, tick]);
  const popup = active.find(promotion => promotion.popup_enabled && !dismissed(promotion));
  const banner = active.find(promotion => promotion.banner_enabled);
  const visibleBanner = popup || !banner || bannerDismissed(banner) ? null : banner;

  useEffect(() => {
    const root = document.documentElement;
    const element = bannerRef.current;
    if (!visibleBanner || !element) {
      root.style.setProperty('--public-promo-height', '0px');
      return undefined;
    }
    const publishHeight = () => root.style.setProperty('--public-promo-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(element);
    window.addEventListener('resize', publishHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publishHeight);
      root.style.setProperty('--public-promo-height', '0px');
    };
  }, [visibleBanner]);

  const closePopup = useCallback(() => {
    if (!popup) return;
    try { sessionStorage.setItem(storageKey(popup), 'dismissed'); } catch { /* Storage can be unavailable in privacy mode. */ }
    setDismissEpoch(value => value + 1);
  }, [popup]);

  const closeBanner = useCallback(() => {
    if (!banner) return;
    try { sessionStorage.setItem(bannerStorageKey(banner), 'dismissed'); } catch { /* Storage can be unavailable in privacy mode. */ }
    setBannerDismissEpoch(value => value + 1);
  }, [banner]);

  useEffect(() => {
    if (!popup) return undefined;
    const previous = document.activeElement;
    const dialog = document.querySelector('.public-promo-dialog');
    const focusables = () => [...(dialog?.querySelectorAll('a[href],button:not([disabled])') || [])];
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closePopup(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables(); if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => focusables()[0]?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = oldOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  // dismissEpoch makes the storage-backed dismissal immediately observable.
  }, [popup, dismissEpoch, closePopup]);

  if (!popup && !visibleBanner) return null;
  return <>
    {visibleBanner && <PromotionBanner ref={bannerRef} promotion={visibleBanner} now={tick} isEnglish={isEnglish} onClose={closeBanner} />}
    {popup && <PromotionDialog promotion={popup} now={tick} onClose={closePopup} isEnglish={isEnglish} />}
  </>;
}

function PromotionCountdown({ promotion, now, compact = false, isEnglish = false }) {
  const copy = PROMO_COPY[isEnglish ? 'en' : 'ar'];
  return <div className={`public-promo-countdown ${compact ? 'compact' : ''}`} aria-label={copy.remaining}>
    {countdown(cairoDateTimeToEpoch(promotion.ends_at) - now, copy).map(part => <span key={part.label}><strong>{part.value}</strong><small>{part.label}</small></span>)}
  </div>;
}

function PromotionLink({ promotion, className, onClick, isEnglish = false, label, labelDir }) {
  const Arrow = isEnglish ? ArrowRight : ArrowLeft;
  return <a className={className} href={promotion.cta_url} target={safeExternal(promotion.cta_url) ? '_blank' : undefined} rel={safeExternal(promotion.cta_url) ? 'noopener noreferrer' : undefined} onClick={onClick}>
    <span dir={labelDir}>{label}</span><Arrow size={18} aria-hidden="true" />
  </a>;
}

function PromotionDialog({ promotion, now, onClose, isEnglish }) {
  const copy = PROMO_COPY[isEnglish ? 'en' : 'ar'];
  const content = promotionContent(promotion, isEnglish);
  return <div className="public-promo-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="public-promo-dialog" role="dialog" aria-modal="true" aria-labelledby="public-promo-title" dir={isEnglish ? 'ltr' : 'rtl'}>
      <button className="public-promo-close" type="button" onClick={onClose} aria-label={copy.close}><X /></button>
      <div className="public-promo-dialog__art" aria-hidden="true">
        <span className="public-promo-foil-label">EXCLUSIVE DROP</span>
        <div className="public-promo-gift-mark">
          <span className="public-promo-gift-mark__vertical" />
          <span className="public-promo-gift-mark__diagonal" />
          <span className="public-promo-bow"><i /><i /><b /></span>
          <Sparkles className="public-promo-gift-sparkle" />
        </div>
        <b className="public-promo-seal" dir={content.badge.value ? content.badge.dir : isEnglish ? 'ltr' : 'rtl'}>{content.badge.value || copy.dialogBadge}</b>
        <i className="public-promo-confetti public-promo-confetti--one" />
        <i className="public-promo-confetti public-promo-confetti--two" />
        <i className="public-promo-confetti public-promo-confetti--three" />
      </div>
      <div className="public-promo-dialog__content">
        <span className="public-promo-kicker"><Clock3 size={15} /> {copy.kicker}</span>
        <h2 id="public-promo-title" dir={content.title.dir}>{content.title.value}</h2>
        <p dir={content.description.dir}>{content.description.value}</p>
        <div className="public-promo-value"><div><small>{copy.value}</small><strong dir={content.value.dir}>{content.value.value}</strong>{content.originalPrice !== null && <del dir="ltr">{content.originalPrice}</del>}</div><PromotionCountdown promotion={promotion} now={now} isEnglish={isEnglish} /></div>
        <PromotionLink promotion={promotion} className="public-promo-cta" onClick={onClose} isEnglish={isEnglish} label={content.cta.value} labelDir={content.cta.dir} />
        <small className="public-promo-dialog__note">{copy.note}</small>
      </div>
    </section>
  </div>;
}

function PromotionBanner({ promotion, now, ref, isEnglish, onClose }) {
  const copy = PROMO_COPY[isEnglish ? 'en' : 'ar'];
  const content = promotionContent(promotion, isEnglish);
  return <aside ref={ref} className="public-promo-banner" aria-label={copy.bannerLabel} dir={isEnglish ? 'ltr' : 'rtl'}>
    <div className="public-promo-banner__badge"><Sparkles size={16} /> <span>{copy.bannerBadge}</span></div>
    <div className="public-promo-banner__copy"><strong dir={content.title.dir}>{content.title.value}</strong><span dir={content.value.dir}>{promotion.promotional_price !== null ? `${copy.now} ${content.value.value}` : content.value.value}</span></div>
    <div className="public-promo-banner__timer"><span className="public-promo-banner__timer-label"><Clock3 size={14} />{copy.endsIn}</span><PromotionCountdown promotion={promotion} now={now} compact isEnglish={isEnglish} /></div>
    <PromotionLink promotion={promotion} className="public-promo-banner__cta" isEnglish={isEnglish} label={content.cta.value} labelDir={content.cta.dir} />
    <button className="public-promo-banner__close" type="button" onClick={onClose} aria-label={copy.closeBanner}><X size={18} /></button>
  </aside>;
}
