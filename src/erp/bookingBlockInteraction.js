export function bindBookingBlockDoubleClick(element, onDoubleClick) {
  if (!element?.addEventListener || typeof onDoubleClick !== 'function') return () => {};
  const listener = event => {
    if (typeof event.button === 'number' && event.button !== 0) return;
    onDoubleClick(event);
  };
  element.addEventListener('dblclick', listener);
  return () => element.removeEventListener('dblclick', listener);
}
