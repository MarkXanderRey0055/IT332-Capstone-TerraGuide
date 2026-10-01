import { useEffect, useRef } from 'react';

type ModalAccessibilityOptions = {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

type ActiveModal = {
  element: HTMLElement;
  previousFocus: HTMLElement | null;
};

const activeModals: ActiveModal[] = [];

const getFocusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

export function useModalAccessibility({
  isOpen,
  onClose,
  initialFocusRef,
}: ModalAccessibilityOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);

  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusRefRef.current = initialFocusRef;
  }, [onClose, initialFocusRef]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const activeModal: ActiveModal = {
      element: modal,
      previousFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    activeModals.push(activeModal);

    const focusInitialElement = () => {
      const preferred = initialFocusRefRef.current?.current;
      const focusable = getFocusableElements(modal);
      (preferred && modal.contains(preferred) ? preferred : focusable[0] ?? modal).focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeModals[activeModals.length - 1] !== activeModal) return;

      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(modal);
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (activeModals[activeModals.length - 1] !== activeModal) return;
      if (!modal.contains(event.target as Node)) focusInitialElement();
    };

    // Capture key events at the document level so native controls such as
    // select elements cannot prevent Escape from reaching the active modal.
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn);
    const focusTimer = window.setTimeout(focusInitialElement, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn);
      const index = activeModals.indexOf(activeModal);
      if (index !== -1) activeModals.splice(index, 1);

      if (activeModal.previousFocus?.isConnected) activeModal.previousFocus.focus();
    };
  }, [isOpen]);

  return modalRef;
}
