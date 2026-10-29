import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarRange, Camera, Clapperboard, Code2, Mic2, MonitorSmartphone, Palette, Pause, Play, Share2, Smartphone, WandSparkles } from 'lucide-react';
import { publicServiceCatalog } from '../data/publicServiceCatalog';
import { goldServiceOrder } from '../data/goldHero';
import { localizePublicPath } from '../lib/publicRoutes';

const serviceIcons = { Camera, Smartphone, Clapperboard, Mic2, CalendarRange, Share2, Palette, MonitorSmartphone, Code2, WandSparkles };
const services = goldServiceOrder.map(slug => publicServiceCatalog.find(service => service.slug === slug)).filter(Boolean);
const slides = [...services, ...services.slice(0, 3)];
const motionPreference = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

export default function ServicePhotoCarousel({ isEnglish }) {
  const viewportRef = useRef(null); const frameRef = useRef(null); const lockedRef = useRef(false);
  const [geometry, setGeometry] = useState({ step: 0, visible: 3 });
  const [index, setIndex] = useState(0); const [animated, setAnimated] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(motionPreference);
  const [autoplay, setAutoplay] = useState(() => !motionPreference());
  const [hovered, setHovered] = useState(false); const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(() => document.hidden);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const visible = viewport.clientWidth > 1050 ? 3 : viewport.clientWidth > 650 ? 2 : 1;
      setGeometry({ visible, step: (viewport.clientWidth + 16) / visible });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const updateMotion = event => {
      setReducedMotion(event.matches);
      if (event.matches) {
        setAutoplay(false); setAnimated(false); lockedRef.current = false;
        window.cancelAnimationFrame(frameRef.current);
        setIndex(current => current % services.length);
      }
    };
    const updateVisibility = () => setPageHidden(document.hidden);
    media?.addEventListener?.('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => { media?.removeEventListener?.('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility); window.cancelAnimationFrame(frameRef.current); };
  }, []);

  const afterTwoFrames = callback => {
    frameRef.current = window.requestAnimationFrame(() => { frameRef.current = window.requestAnimationFrame(callback); });
  };
  const move = useCallback(direction => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    if (reducedMotion) {
      setIndex(current => (current + direction + services.length) % services.length);
      lockedRef.current = false;
    } else if (direction < 0 && index === 0) {
      setAnimated(false); setIndex(services.length);
      afterTwoFrames(() => { setAnimated(true); setIndex(services.length - 1); });
    } else {
      setAnimated(true); setIndex(current => current + direction);
    }
  }, [index, reducedMotion]);

  useEffect(() => {
    if (!autoplay || hovered || focused || reducedMotion || pageHidden) return undefined;
    const timer = window.setInterval(() => move(1), 4000);
    return () => window.clearInterval(timer);
  }, [autoplay, hovered, focused, reducedMotion, pageHidden, move]);

  const finishSlide = event => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (index >= services.length) {
      setAnimated(false); setIndex(0);
      afterTwoFrames(() => { setAnimated(true); lockedRef.current = false; });
    } else lockedRef.current = false;
  };
  const activeIndex = index % services.length;
  return <div className="gold-service-carousel" role="region" aria-roledescription={isEnglish ? 'carousel' : 'عارض صور'} aria-label={isEnglish ? 'Explore our services' : 'تعرّف على خدماتنا'}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="gold-service-carousel__viewport" ref={viewportRef}>
      <div className="gold-service-carousel__track" dir="ltr" style={{ '--visible-slides': geometry.visible, transform: `translate3d(${-index * geometry.step}px,0,0)`, transition: animated && !reducedMotion ? undefined : 'none' }} onTransitionEnd={finishSlide}>
        {slides.map((service, position) => {
          const copy = isEnglish ? service.en : service.ar;
          const Icon = serviceIcons[service.icon] || Camera;
          const inView = position >= index && position < index + geometry.visible;
          return <Link className="gold-service-slide" key={`${service.slug}-${position}`} to={localizePublicPath(`/services/${service.slug}`, isEnglish ? 'en' : 'ar')} dir={isEnglish ? 'ltr' : 'rtl'} tabIndex={inView ? 0 : -1} aria-hidden={!inView ? true : undefined} inert={!inView}>
            <img src={`/brand/gold/services/${service.slug}.webp`} srcSet={`/brand/gold/services/${service.slug}-small.webp 640w, /brand/gold/services/${service.slug}.webp 960w`} sizes="(max-width: 680px) 90vw, (max-width: 1100px) 48vw, 33vw" width="960" height="640" alt={isEnglish ? `Illustration of ${copy.navLabel}` : `صورة توضيحية لخدمة ${copy.navLabel}`} loading={position < 3 ? 'eager' : 'lazy'} fetchPriority={position === 0 ? 'high' : 'low'} decoding="async"/>
            <span className="gold-service-slide__caption"><Icon aria-hidden="true"/><span>{copy.navLabel}</span></span>
          </Link>;
        })}
      </div>
    </div>
    <div className="gold-service-carousel__controls" dir="ltr">
      <button type="button" onClick={() => move(-1)} aria-label={isEnglish ? 'Previous service' : 'الخدمة السابقة'}><ArrowLeft aria-hidden="true"/></button>
      <button type="button" onClick={() => setAutoplay(current => !current)} disabled={reducedMotion} aria-pressed={!autoplay} aria-label={autoplay ? (isEnglish ? 'Pause automatic slides' : 'إيقاف الحركة التلقائية') : (isEnglish ? 'Play automatic slides' : 'تشغيل الحركة التلقائية')}>{autoplay ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}</button>
      <span className="gold-service-carousel__counter" aria-live="off">{String(activeIndex + 1).padStart(2, '0')} <i/> {String(services.length).padStart(2, '0')}</span>
      <button type="button" onClick={() => move(1)} aria-label={isEnglish ? 'Next service' : 'الخدمة التالية'}><ArrowRight aria-hidden="true"/></button>
    </div>
  </div>;
}
