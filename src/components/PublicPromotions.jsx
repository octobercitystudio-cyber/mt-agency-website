import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Clock3, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatEGP } from '../lib/businessFormat';
import { promotionApi } from '../lib/promotionApi';
import { cairoDateTimeToEpoch } from '../lib/promotionTime';
import { millisecondsToNextSecond, promotionCountdownParts, promotionIsVisibleAt } from '../lib/promotionCountdown';
import { createPromotionCarouselScheduler, createPromotionFocusModality, logicalStepForArrow, logicalStepForSwipe, orderPublicPromotions, resolvePromotionId, stepPromotionId } from '../lib/promotionCarousel';
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
  ar: {
    day: 'يوم', hour: 'ساعة', minute: 'دقيقة', second: 'ثانية', dayShort: 'يوم', hourShort: 'س', minuteShort: 'د', secondShort: 'ث',
    remaining: 'الوقت المتبقي للعرض', endsIn: 'ينتهي خلال', close: 'إغلاق نافذة العرض', closeBanner: 'إغلاق شريط العروض',
    kicker: 'عرض حصري ينتهي قريبًا', value: 'قيمة العرض', note: 'يُطبق العرض خلال الفترة المحددة وحسب توافر الخدمة.',
    dialogBadge: 'لفترة محدودة', bannerBadge: 'عرض حصري', bannerLabel: 'العروض الحصرية المتاحة الآن', now: 'الآن',
    carousel: 'عروض حصرية متتابعة', item: (current, total) => `عرض ${current} من ${total}`,
    previous: 'العرض السابق', next: 'العرض التالي',
    mobileStrip: 'عرض حصري لفترة محدودة', mobileOpen: 'فتح تفاصيل العرض',
  },
  en: {
    day: 'Days', hour: 'Hours', minute: 'Minutes', second: 'Seconds', dayShort: 'Day', hourShort: 'Hr', minuteShort: 'Min', secondShort: 'Sec',
    remaining: 'Time remaining for this offer', endsIn: 'Ends in', close: 'Close offer dialog', closeBanner: 'Close offer banner',
    kicker: 'Exclusive offer ending soon', value: 'Offer value', note: 'Offer applies during the stated period and is subject to service availability.',
    dialogBadge: 'Limited time', bannerBadge: 'Exclusive offer', bannerLabel: 'Exclusive offers available now', now: 'Now',
    carousel: 'Rotating exclusive offers', item: (current, total) => `Offer ${current} of ${total}`,
    previous: 'Previous offer', next: 'Next offer',
    mobileStrip: 'Exclusive limited-time offer', mobileOpen: 'Open offer details',
  },
};

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches || false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = event => setMatches(event.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}

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

function usePromotionCarousel(items, isEnglish) {
  const [activeId, setActiveId] = useState(null);
  const [direction, setDirection] = useState(1);
  const [rotationEpoch, setRotationEpoch] = useState(0);
  const [pause, setPause] = useState({ hover: false, focus: false, touch: false, hidden: document.hidden, action: false });
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);
  const touchStart = useRef(null);
  const actionTimer = useRef(null);
  const itemsRef = useRef(items);
  const focusModality = useRef(createPromotionFocusModality());
  const itemsKey = items.map(item => String(item.id)).join('|');
  const resolvedId = resolvePromotionId(items, activeId);
  const activeIndex = items.findIndex(item => String(item.id) === String(resolvedId));

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (String(activeId) === String(resolvedId)) return undefined;
    const reconciliation = window.setTimeout(() => setActiveId(resolvedId), 0);
    return () => window.clearTimeout(reconciliation);
  }, [activeId, resolvedId]);

  useEffect(() => {
    const onVisibilityChange = () => setPause(value => ({ ...value, hidden: document.hidden }));
    const onKeyboardInput = event => focusModality.current.onKeyboardInput(event.key);
    const onPointerInput = () => focusModality.current.onPointerInput();
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotionChange = event => setReducedMotion(event.matches);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('keydown', onKeyboardInput, true);
    document.addEventListener('pointerdown', onPointerInput, true);
    media?.addEventListener?.('change', onMotionChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', onKeyboardInput, true);
      document.removeEventListener('pointerdown', onPointerInput, true);
      media?.removeEventListener?.('change', onMotionChange);
      if (actionTimer.current) window.clearTimeout(actionTimer.current);
    };
  }, []);

  const navigate = useCallback((step, requestedId = null) => {
    if (!itemsKey) return;
    setDirection(Number(step) >= 0 ? 1 : -1);
    setActiveId(requestedId ?? stepPromotionId(itemsRef.current, resolvedId, step));
    setRotationEpoch(value => value + 1);
  }, [itemsKey, resolvedId]);

  useEffect(() => {
    const scheduler = createPromotionCarouselScheduler({
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: timer => window.clearTimeout(timer),
      onRotate: () => navigate(1),
    });
    scheduler.sync({ length: items.length, pauseReasons: pause, reducedMotion });
    return scheduler.destroy;
  }, [items.length, navigate, pause, reducedMotion, rotationEpoch]);

  const pauseForAction = useCallback(() => {
    setPause(value => ({ ...value, action: true }));
    if (actionTimer.current) window.clearTimeout(actionTimer.current);
    actionTimer.current = window.setTimeout(() => setPause(value => ({ ...value, action: false })), 1200);
  }, []);

  const prepareProgrammaticFocus = useCallback(() => {
    focusModality.current.onProgrammaticFocus();
    setPause(value => ({ ...value, focus: false }));
  }, []);

  const isRtl = !isEnglish;
  const interactionProps = {
    onMouseEnter: () => setPause(value => ({ ...value, hover: true })),
    onMouseLeave: () => setPause(value => ({ ...value, hover: false })),
    onPointerDownCapture: () => {
      focusModality.current.onPointerInput();
      setPause(value => ({ ...value, focus: false }));
    },
    onFocusCapture: () => {
      if (focusModality.current.shouldPauseOnFocus()) setPause(value => ({ ...value, focus: true }));
    },
    onBlurCapture: event => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        focusModality.current.onFocusLeft();
        setPause(value => ({ ...value, focus: false }));
      }
    },
    onKeyDown: event => {
      focusModality.current.onKeyboardInput(event.key);
      if (focusModality.current.shouldPauseOnFocus()) setPause(value => ({ ...value, focus: true }));
      const step = logicalStepForArrow(event.key, isRtl);
      if (!step || items.length < 2) return;
      event.preventDefault();
      navigate(step);
    },
    onTouchStart: event => {
      touchStart.current = event.touches[0]?.clientX ?? null;
      setPause(value => ({ ...value, touch: true }));
    },
    onTouchEnd: event => {
      const end = event.changedTouches[0]?.clientX;
      const step = logicalStepForSwipe(Number(end) - Number(touchStart.current), isRtl);
      touchStart.current = null;
      setPause(value => ({ ...value, touch: false }));
      if (step && items.length > 1) navigate(step);
    },
    onTouchCancel: () => {
      touchStart.current = null;
      setPause(value => ({ ...value, touch: false }));
    },
  };

  return { activeId: resolvedId, activeIndex, direction, navigate, pauseForAction, prepareProgrammaticFocus, interactionProps };
}

export default function PublicPromotions() {
  const { i18n } = useTranslation();
  const isEnglish = String(i18n.resolvedLanguage || i18n.language).startsWith('en');
  const isMobile = useMediaQuery('(max-width: 680px)');
  const [promotions, setPromotions] = useState([]);
  const [tick, setTick] = useState(0);
  const [popupSuppressed, setPopupSuppressed] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [bannerSuppressed, setBannerSuppressed] = useState(false);
  const [dismissEpoch, setDismissEpoch] = useState(0);
  const clockOffset = useRef(0);
  const bannerRef = useRef(null);

  useEffect(() => {
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      promotionApi.public(controller.signal).then(result => {
        clockOffset.current = result?.server_now ? new Date(result.server_now).getTime() - Date.now() : 0;
        setPromotions(Array.isArray(result?.items) ? result.items : []);
        setTick(Date.now() + clockOffset.current);
      }).catch(() => {});
    };
    load();
    const onStorage = event => { if (!event.key || event.key.includes('exclusive-promotions')) load(); };
    window.addEventListener('erpPromotionsUpdated', load);
    window.addEventListener('storage', onStorage);
    return () => {
      controller.abort();
      window.removeEventListener('erpPromotionsUpdated', load);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!promotions.length) return undefined;
    let interval;
    const publishTick = () => setTick(Date.now() + clockOffset.current);
    const boundaryTimer = window.setTimeout(() => {
      publishTick();
      interval = window.setInterval(publishTick, 1000);
    }, millisecondsToNextSecond(Date.now() + clockOffset.current));
    return () => {
      window.clearTimeout(boundaryTimer);
      if (interval) window.clearInterval(interval);
    };
  }, [promotions]);

  const active = useMemo(() => orderPublicPromotions(promotions
    .filter(promotion => promotionIsVisibleAt(promotion, tick, cairoDateTimeToEpoch))), [promotions, tick]);
  const popupItems = useMemo(() => {
    void dismissEpoch;
    return active.filter(promotion => promotion.popup_enabled && !dismissed(promotion));
  }, [active, dismissEpoch]);
  const bannerItems = useMemo(() => {
    void dismissEpoch;
    return active.filter(promotion => promotion.banner_enabled && !bannerDismissed(promotion));
  }, [active, dismissEpoch]);
  const popupOpen = manualDialogOpen || (!popupSuppressed && popupItems.length > 0);
  const carouselItems = manualDialogOpen ? bannerItems : (popupOpen ? popupItems : bannerItems);
  const carousel = usePromotionCarousel(carouselItems, isEnglish);
  const pauseForAction = carousel.pauseForAction;
  const prepareProgrammaticFocus = carousel.prepareProgrammaticFocus;
  const promotion = carouselItems.find(item => String(item.id) === String(carousel.activeId)) || null;
  const visibleBanner = (!popupOpen || manualDialogOpen) && !bannerSuppressed ? promotion : null;

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
  }, [isMobile, visibleBanner]);

  const closePopup = useCallback(() => {
    if (!promotion) return;
    pauseForAction();
    if (manualDialogOpen) {
      setManualDialogOpen(false);
      return;
    }
    try { sessionStorage.setItem(storageKey(promotion), 'dismissed'); } catch { /* Storage can be unavailable in privacy mode. */ }
    setPopupSuppressed(true);
    setDismissEpoch(value => value + 1);
  }, [manualDialogOpen, promotion, pauseForAction]);

  const openBannerDialog = useCallback(() => {
    pauseForAction();
    setPopupSuppressed(true);
    setManualDialogOpen(true);
  }, [pauseForAction]);

  const closeBanner = useCallback(() => {
    if (!promotion) return;
    pauseForAction();
    try { sessionStorage.setItem(bannerStorageKey(promotion), 'dismissed'); } catch { /* Storage can be unavailable in privacy mode. */ }
    setBannerSuppressed(true);
    setDismissEpoch(value => value + 1);
  }, [promotion, pauseForAction]);

  const closePopupRef = useRef(closePopup);
  useEffect(() => { closePopupRef.current = closePopup; }, [closePopup]);

  useEffect(() => {
    if (!popupOpen) return undefined;
    const previous = document.activeElement;
    const dialog = document.querySelector('.public-promo-dialog');
    const focusables = () => [...(dialog?.querySelectorAll('a[href],button:not([disabled])') || [])];
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closePopupRef.current(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables(); if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => {
      prepareProgrammaticFocus();
      focusables()[0]?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = oldOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [popupOpen, prepareProgrammaticFocus]);

  if (!promotion) return null;
  const copy = PROMO_COPY[isEnglish ? 'en' : 'ar'];
  const position = copy.item(carousel.activeIndex + 1, carouselItems.length);
  return <>
    <span className="public-promo-live" aria-live="polite" aria-atomic="true">{carouselItems.length > 1 ? `${position}: ${promotionContent(promotion, isEnglish).title.value}` : ''}</span>
    {visibleBanner && <PromotionBanner bannerRef={bannerRef} promotion={promotion} promotions={carouselItems} now={tick} isEnglish={isEnglish} isMobile={isMobile} onClose={closeBanner} onOpen={openBannerDialog} carousel={carousel} />}
    {popupOpen && <PromotionDialog promotion={promotion} promotions={carouselItems} now={tick} onClose={closePopup} isEnglish={isEnglish} carousel={carousel} />}
  </>;
}

function PromotionCountdown({ promotion, now, compact = false, isEnglish = false }) {
  const copy = PROMO_COPY[isEnglish ? 'en' : 'ar'];
  const labels = compact ? { ...copy, day: copy.dayShort, hour: copy.hourShort, minute: copy.minuteShort, second: copy.secondShort } : copy;
  const parts = promotionCountdownParts(cairoDateTimeToEpoch(promotion.ends_at) - now, labels);
  if (!parts) return null;
  return <div className={`public-promo-countdown ${compact ? 'compact' : ''}`} aria-label={copy.remaining} dir={isEnglish ? 'ltr' : 'rtl'}>
    {parts.map(part => <span key={part.unit} data-unit={part.unit}><strong>{part.value}</strong><small>{part.label}</small></span>)}
  </div>;
}

function PromotionLink({ promotion, className, onActionStart, onClick, isEnglish = false, label, labelDir }) {
  const Arrow = isEnglish ? ArrowRight : ArrowLeft;
  return <a className={className} href={promotion.cta_url} target={safeExternal(promotion.cta_url) ? '_blank' : undefined} rel={safeExternal(promotion.cta_url) ? 'noopener noreferrer' : undefined} onPointerDown={onActionStart} onClick={onClick}>
    <span dir={labelDir}>{label}</span><Arrow size={18} aria-hidden="true" />
  </a>;
}

function CarouselSideControls({ promotions, navigate, isEnglish, compact = false }) {
  if (promotions.length < 2) return null;
  const copy = PROMO_COPY[isEnglish ? 'en' : 'ar'];
  const leftStep = isEnglish ? -1 : 1;
  const rightStep = leftStep * -1;
  const actionLabel = step => step < 0 ? copy.previous : copy.next;
  return <div className={`public-promo-carousel-side-controls ${compact ? 'compact' : ''}`} role="group" aria-label={copy.carousel}>
    <button type="button" className="public-promo-carousel-arrow public-promo-carousel-arrow--left" onClick={() => navigate(leftStep)} aria-label={actionLabel(leftStep)}><ArrowLeft aria-hidden="true" /></button>
    <button type="button" className="public-promo-carousel-arrow public-promo-carousel-arrow--right" onClick={() => navigate(rightStep)} aria-label={actionLabel(rightStep)}><ArrowRight aria-hidden="true" /></button>
  </div>;
}

function PromotionDialog({ promotion, promotions, now, onClose, isEnglish, carousel }) {
  const copy = PROMO_COPY[isEnglish ? 'en' : 'ar'];
  const content = promotionContent(promotion, isEnglish);
  const position = copy.item(carousel.activeIndex + 1, promotions.length);
  const close = () => { carousel.pauseForAction(); onClose(); };
  return <div className="public-promo-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
    <div className={`public-promo-dialog-stack ${promotions.length > 1 ? 'has-stack' : ''}`}>
      <section className="public-promo-dialog" role="dialog" aria-modal="true" aria-labelledby="public-promo-title" aria-roledescription={copy.carousel} aria-label={`${copy.carousel}: ${position}`} dir={isEnglish ? 'ltr' : 'rtl'} tabIndex="0" {...carousel.interactionProps}>
        <button className="public-promo-close" type="button" onPointerDown={carousel.pauseForAction} onClick={close} aria-label={copy.close}><X /></button>
        <CarouselSideControls promotions={promotions} navigate={carousel.navigate} isEnglish={isEnglish} />
        <div key={promotion.id} className={`public-promo-dialog__slide public-promo-slide public-promo-slide--${carousel.direction > 0 ? 'next' : 'previous'}`} role="group" aria-roledescription={isEnglish ? 'slide' : 'شريحة'} aria-label={position}>
          <div className="public-promo-dialog__art" aria-hidden="true">
            <span className="public-promo-foil-label">EXCLUSIVE DROP</span>
            <div className="public-promo-gift-mark"><span className="public-promo-gift-mark__vertical" /><span className="public-promo-gift-mark__diagonal" /><span className="public-promo-bow"><i /><i /><b /></span><Sparkles className="public-promo-gift-sparkle" /></div>
            <b className="public-promo-seal" dir={content.badge.value ? content.badge.dir : isEnglish ? 'ltr' : 'rtl'}>{content.badge.value || copy.dialogBadge}</b>
            <i className="public-promo-confetti public-promo-confetti--one" /><i className="public-promo-confetti public-promo-confetti--two" /><i className="public-promo-confetti public-promo-confetti--three" />
          </div>
          <div className="public-promo-dialog__content">
            <div className="public-promo-heading-row"><span className="public-promo-kicker"><Clock3 size={15} /> {copy.kicker}</span></div>
            <h2 id="public-promo-title" dir={content.title.dir}>{content.title.value}</h2>
            <p dir={content.description.dir}>{content.description.value}</p>
            <div className="public-promo-value"><div><small>{copy.value}</small><strong dir={content.value.dir}>{content.value.value}</strong>{content.originalPrice !== null && <del dir="ltr">{content.originalPrice}</del>}</div><PromotionCountdown promotion={promotion} now={now} isEnglish={isEnglish} /></div>
            <PromotionLink promotion={promotion} className="public-promo-cta" onActionStart={carousel.pauseForAction} onClick={onClose} isEnglish={isEnglish} label={content.cta.value} labelDir={content.cta.dir} />
            <small className="public-promo-dialog__note">{copy.note}</small>
          </div>
        </div>
      </section>
    </div>
  </div>;
}

function PromotionBanner({ promotion, promotions, now, bannerRef, isEnglish, isMobile, onClose, onOpen, carousel }) {
  const copy = PROMO_COPY[isEnglish ? 'en' : 'ar'];
  const content = promotionContent(promotion, isEnglish);
  const position = copy.item(carousel.activeIndex + 1, promotions.length);
  const close = () => { carousel.pauseForAction(); onClose(); };
  if (isMobile) {
    const offerContext = promotions.length > 1 ? `${position}. ${copy.mobileOpen}` : copy.mobileOpen;
    return <button ref={bannerRef} type="button" className={`public-promo-banner public-promo-banner--mobile ${promotions.length > 1 ? 'has-stack' : ''}`} aria-label={offerContext} dir={isEnglish ? 'ltr' : 'rtl'} onClick={onOpen} {...carousel.interactionProps}>
      <span className="public-promo-banner__mobile-copy"><Sparkles size={15} aria-hidden="true" /><strong>{copy.mobileStrip}</strong></span>
      <PromotionCountdown promotion={promotion} now={now} compact isEnglish={isEnglish} />
      <span className="public-promo-banner__expand" aria-hidden="true"><ChevronDown /></span>
    </button>;
  }
  return <aside ref={bannerRef} className={`public-promo-banner ${promotions.length > 1 ? 'has-stack' : ''}`} aria-label={`${copy.bannerLabel}: ${position}`} aria-roledescription={copy.carousel} dir={isEnglish ? 'ltr' : 'rtl'} tabIndex="0" {...carousel.interactionProps}>
    <div className="public-promo-banner__badge"><Sparkles size={16} /><span>{copy.bannerBadge}</span></div>
    <div key={promotion.id} className={`public-promo-banner__copy public-promo-slide public-promo-slide--${carousel.direction > 0 ? 'next' : 'previous'}`} role="group" aria-roledescription={isEnglish ? 'slide' : 'شريحة'} aria-label={position}><strong dir={content.title.dir}>{content.title.value}</strong><span dir={content.value.dir}>{promotion.promotional_price !== null ? `${copy.now} ${content.value.value}` : content.value.value}</span></div>
    <div className="public-promo-banner__timer"><span className="public-promo-banner__timer-label"><Clock3 size={14} />{copy.endsIn}</span><PromotionCountdown promotion={promotion} now={now} compact isEnglish={isEnglish} /></div>
    <PromotionLink promotion={promotion} className="public-promo-banner__cta" onActionStart={carousel.pauseForAction} onClick={carousel.pauseForAction} isEnglish={isEnglish} label={content.cta.value} labelDir={content.cta.dir} />
    <button className="public-promo-banner__close" type="button" onPointerDown={carousel.pauseForAction} onClick={close} aria-label={copy.closeBanner}><X size={18} /></button>
    <CarouselSideControls promotions={promotions} navigate={carousel.navigate} isEnglish={isEnglish} compact />
  </aside>;
}
