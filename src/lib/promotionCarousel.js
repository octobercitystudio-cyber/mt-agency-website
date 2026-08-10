const numericId = value => String(value ?? '');
export const PROMOTION_ROTATION_MS = 6400;

export const promotionIsRenderable = promotion => {
  if (!promotion || numericId(promotion.id) === '') return false;
  if (!String(promotion.public_title || '').trim()) return false;
  if (!String(promotion.description || '').trim()) return false;
  if (!String(promotion.cta_label || '').trim()) return false;
  if (!String(promotion.cta_url || '').trim()) return false;
  return Boolean(Number(promotion.popup_enabled) || Number(promotion.banner_enabled));
};

export const orderPublicPromotions = promotions => [...promotions]
  .filter(promotionIsRenderable)
  .sort((a, b) => {
    const priorityDifference = Number(b.priority || 0) - Number(a.priority || 0);
    if (priorityDifference) return priorityDifference;
    const createdDifference = Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0);
    if (Number.isFinite(createdDifference) && createdDifference) return createdDifference;
    return numericId(b.id).localeCompare(numericId(a.id), undefined, { numeric: true });
  });

export const resolvePromotionId = (promotions, currentId) => {
  if (!promotions.length) return null;
  const current = promotions.find(item => numericId(item.id) === numericId(currentId));
  return current ? current.id : promotions[0].id;
};

export const stepPromotionId = (promotions, currentId, step = 1) => {
  if (!promotions.length) return null;
  const currentIndex = promotions.findIndex(item => numericId(item.id) === numericId(currentId));
  const safeIndex = currentIndex < 0 ? 0 : currentIndex;
  const nextIndex = (safeIndex + Number(step || 0) % promotions.length + promotions.length) % promotions.length;
  return promotions[nextIndex].id;
};

export const logicalStepForArrow = (key, isRtl) => {
  if (key === 'ArrowRight') return isRtl ? -1 : 1;
  if (key === 'ArrowLeft') return isRtl ? 1 : -1;
  return 0;
};

export const logicalStepForSwipe = (deltaX, isRtl, threshold = 48) => {
  if (Math.abs(Number(deltaX) || 0) < threshold) return 0;
  const physicalStep = deltaX < 0 ? 1 : -1;
  return isRtl ? -physicalStep : physicalStep;
};

export const promotionCarouselCanRotate = (length, pauseReasons = {}, reducedMotion = false) => (
  Number(length) > 1 && !reducedMotion && !Object.values(pauseReasons).some(Boolean)
);

export const createPromotionFocusModality = () => {
  let keyboard = false;
  return {
    onKeyboardInput(key) {
      if (key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight') keyboard = true;
    },
    onProgrammaticFocus() { keyboard = false; },
    onPointerInput() { keyboard = false; },
    onFocusLeft() { keyboard = false; },
    shouldPauseOnFocus() { return keyboard; },
  };
};

export const createPromotionCarouselScheduler = ({ schedule, cancel, interval = PROMOTION_ROTATION_MS, onRotate }) => {
  let timer = null;
  const clear = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };
  return {
    sync({ length, pauseReasons = {}, reducedMotion = false }) {
      clear();
      if (!promotionCarouselCanRotate(length, pauseReasons, reducedMotion)) return;
      timer = schedule(() => {
        timer = null;
        onRotate();
      }, interval);
    },
    destroy: clear,
    hasPendingRotation: () => timer !== null,
  };
};
