import { useEffect, useRef } from 'react';

const focusableSelector = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
const openModalStack = [];
let scrollLockPreviousOverflow = '';

export default function useModalDialog(isOpen, onClose, { returnFocusRef, isolateBackground = false } = {}) {
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
    const isolatedElements = [];
    if (isolateBackground && dialog) {
      const isolatedSet = new Set();
      let activeBranch = dialog;
      while (activeBranch.parentElement) {
        const parent = activeBranch.parentElement;
        [...parent.children].forEach(element => {
          if (element === activeBranch || element.contains(dialog) || isolatedSet.has(element)) return;
          isolatedSet.add(element);
          isolatedElements.push({ element, ariaHidden: element.getAttribute('aria-hidden'), inert: element.inert });
          element.inert = true;
          element.setAttribute('aria-hidden', 'true');
        });
        if (parent === document.body) break;
        activeBranch = parent;
      }
    }

    const focusables = () => [...(dialog?.querySelectorAll(focusableSelector) || [])];
    const focusInside = () => {
      const target = focusables()[0] || dialog;
      target?.focus({ preventScroll: true });
    };
    const handleKeyDown = event => {
      if (openModalStack.at(-1) !== modalToken) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        dialog?.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items.at(-1);
      if (!dialog?.contains(document.activeElement) || document.activeElement === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleFocusIn = event => {
      if (openModalStack.at(-1) !== modalToken || !dialog || dialog.contains(event.target)) return;
      focusInside();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn, true);
    window.requestAnimationFrame(() => (dialog?.querySelector('[data-dialog-initial]:not([disabled])') || focusables()[0])?.focus());
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn, true);
      const stackIndex = openModalStack.lastIndexOf(modalToken);
      if (stackIndex !== -1) openModalStack.splice(stackIndex, 1);
      isolatedElements.forEach(({ element, ariaHidden, inert }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden);
      });
      document.body.style.overflow = openModalStack.length ? 'hidden' : scrollLockPreviousOverflow;
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, [isOpen, isolateBackground, returnFocusRef]);

  return dialogRef;
}
