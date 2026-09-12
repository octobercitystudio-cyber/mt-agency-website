const DAY_ACTION_CONFLICT_SELECTOR = '.fc-event, .fc-more-link, button, a';

export function shouldIgnoreBookingBlockDoubleClick(event) {
  if (typeof event?.button === 'number' && event.button !== 0) return true;
  return Boolean(event?.target?.closest?.(DAY_ACTION_CONFLICT_SELECTOR));
}

export function bookingBlockDayCellFromEvent(event, calendarRoot) {
  const dayCell = event?.target?.closest?.('.fc-day[data-date]') || null;
  return dayCell && calendarRoot?.contains?.(dayCell) ? dayCell : null;
}

export function bindBookingBlockDoubleClick(element, onDoubleClick) {
  if (!element?.addEventListener || typeof onDoubleClick !== 'function') return () => {};
  const listener = event => {
    if (shouldIgnoreBookingBlockDoubleClick(event)) return;
    onDoubleClick(event);
  };
  element.addEventListener('dblclick', listener);
  return () => element.removeEventListener('dblclick', listener);
}
