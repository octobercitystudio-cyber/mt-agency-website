import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPromotionCarouselScheduler,
  createPromotionFocusModality,
  logicalStepForArrow,
  logicalStepForSwipe,
  orderPublicPromotions,
  PROMOTION_ROTATION_MS,
  promotionCarouselCanRotate,
  resolvePromotionId,
  stepPromotionId,
} from '../src/lib/promotionCarousel.js';

const offer = (id, overrides = {}) => ({
  id,
  public_title: `Offer ${id}`,
  description: 'Complete offer details',
  cta_label: 'Claim offer',
  cta_url: '#contact',
  popup_enabled: true,
  banner_enabled: true,
  priority: 0,
  created_at: `2026-08-0${id}T12:00:00Z`,
  ...overrides,
});

test('public offers are filtered and ordered deterministically by owner priority then recency', () => {
  const ordered = orderPublicPromotions([
    offer(1, { priority: 10 }),
    offer(2, { priority: 30 }),
    offer(3, { priority: 30 }),
    offer(4, { description: '' }),
    offer(5, { popup_enabled: false, banner_enabled: false }),
  ]);
  assert.deepEqual(ordered.map(item => item.id), [3, 2, 1]);
});

test('stable ids survive reorder, recover safely after removal and loop at both ends', () => {
  const items = [offer(1), offer(2), offer(3)];
  assert.equal(resolvePromotionId(items, 2), 2);
  assert.equal(resolvePromotionId([items[2], items[0]], 2), 3);
  assert.equal(stepPromotionId(items, 3, 1), 1);
  assert.equal(stepPromotionId(items, 1, -1), 3);
  assert.equal(stepPromotionId([], 1, 1), null);
});

test('auto rotation uses a calm interval and pauses for every interaction or reduced motion', () => {
  assert.equal(PROMOTION_ROTATION_MS, 6400);
  assert.equal(promotionCarouselCanRotate(1, {}, false), false);
  assert.equal(promotionCarouselCanRotate(2, {}, false), true);
  for (const reason of ['hover', 'focus', 'touch', 'hidden', 'action']) {
    assert.equal(promotionCarouselCanRotate(3, { [reason]: true }, false), false, reason);
  }
  assert.equal(promotionCarouselCanRotate(3, {}, true), false);
});

test('keyboard and swipe navigation follow the reading direction and threshold', () => {
  assert.equal(logicalStepForArrow('ArrowRight', false), 1);
  assert.equal(logicalStepForArrow('ArrowRight', true), -1);
  assert.equal(logicalStepForArrow('ArrowLeft', false), -1);
  assert.equal(logicalStepForArrow('ArrowLeft', true), 1);
  assert.equal(logicalStepForSwipe(-80, false), 1);
  assert.equal(logicalStepForSwipe(-80, true), -1);
  assert.equal(logicalStepForSwipe(80, false), -1);
  assert.equal(logicalStepForSwipe(20, false), 0);
});

test('mounted popup lifecycle auto-advances and wraps after programmatic close-button focus', () => {
  let timerId = 0;
  const timers = new Map();
  const schedule = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; };
  const cancel = id => timers.delete(id);
  const firePending = () => {
    assert.equal(timers.size, 1, 'exactly one rotation timer must be mounted');
    const [id, timer] = timers.entries().next().value;
    timers.delete(id);
    assert.equal(timer.delay, PROMOTION_ROTATION_MS);
    timer.callback();
  };

  const focus = createPromotionFocusModality();
  const pauseReasons = { hover: false, focus: false, touch: false, hidden: false, action: false };
  let activeIndex = 0;
  const scheduler = createPromotionCarouselScheduler({
    schedule,
    cancel,
    onRotate: () => {
      activeIndex = (activeIndex + 1) % 3;
      scheduler.sync({ length: 3, pauseReasons });
    },
  });

  // The accessible modal places focus on Close without any user keyboard input.
  // That programmatic focus must not deadlock the requested automatic loop.
  focus.onKeyboardInput('Tab');
  focus.onProgrammaticFocus();
  pauseReasons.focus = focus.shouldPauseOnFocus();
  scheduler.sync({ length: 3, pauseReasons });
  firePending();
  assert.equal(activeIndex, 1);
  firePending();
  assert.equal(activeIndex, 2);
  firePending();
  assert.equal(activeIndex, 0, 'last offer wraps to the first');

  focus.onKeyboardInput('Tab');
  pauseReasons.focus = focus.shouldPauseOnFocus();
  scheduler.sync({ length: 3, pauseReasons });
  assert.equal(timers.size, 0, 'genuine keyboard focus pauses rotation');

  focus.onFocusLeft();
  pauseReasons.focus = focus.shouldPauseOnFocus();
  scheduler.sync({ length: 3, pauseReasons });
  assert.equal(timers.size, 1, 'blur resumes with one timer');

  scheduler.sync({ length: 3, pauseReasons });
  assert.equal(timers.size, 1, 'manual navigation resets instead of duplicating the timer');
  firePending();
  assert.equal(activeIndex, 1);
  scheduler.destroy();
  assert.equal(timers.size, 0);
});
