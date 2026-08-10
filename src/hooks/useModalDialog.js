import { useEffect, useRef } from 'react';

const focusableSelector = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
const openModalStack = [];
let scrollLockPreviousOverflow = '';

export default function useModalDialog(isOpen, onClose, { returnFocusRef } = {}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const modalTokenRef = useRef(Symbol('modal-dialog'));

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    triggerRef.current = returnFocusRef?.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const dialog = dialogRef.current;
    const modalToken = modalTokenRef.current;
    if (openModalStack.length === 0) scrollLockPreviousOverflow = document.body.style.overflow;
    openModalStack.push(modalToken);
    document.body.style.overflow = 'hidden';

    const focusables = () => [...(dialog?.querySelectorAll(focusableSelector) || [])];
    const handleKeyDown = event => {
      if (openModalStack.at(-1) !== modalToken) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => (dialog?.querySelector('[data-dialog-initial]:not([disabled])') || focusables()[0])?.focus());
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const stackIndex = openModalStack.lastIndexOf(modalToken);
      if (stackIndex !== -1) openModalStack.splice(stackIndex, 1);
      document.body.style.overflow = openModalStack.length ? 'hidden' : scrollLockPreviousOverflow;
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, [isOpen, returnFocusRef]);

  return dialogRef;
}
