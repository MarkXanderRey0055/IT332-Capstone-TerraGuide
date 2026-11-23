import { useEffect, useState, type RefObject } from 'react';

type ScrollCueProps<T extends HTMLElement> = {
  scrollableRef: RefObject<T | null>;
};

export function ScrollCue<T extends HTMLElement>({ scrollableRef }: ScrollCueProps<T>) {
  const [direction, setDirection] = useState<'down' | 'up' | null>(null);

  useEffect(() => {
    const scrollable = scrollableRef.current;
    if (!scrollable) {
      setDirection(null);
      return;
    }

    const updateDirection = () => {
      const hasOverflow = scrollable.scrollHeight > scrollable.clientHeight + 8;
      if (!hasOverflow) {
        setDirection(null);
        return;
      }

      const isAtBottom =
        scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 8;
      setDirection(isAtBottom ? 'up' : 'down');
    };

    updateDirection();
    scrollable.addEventListener('scroll', updateDirection, { passive: true });
    window.addEventListener('resize', updateDirection);

    const resizeObserver = new ResizeObserver(updateDirection);
    resizeObserver.observe(scrollable);

    const mutationObserver = new MutationObserver(updateDirection);
    mutationObserver.observe(scrollable, { childList: true, subtree: true, characterData: true });

    return () => {
      scrollable.removeEventListener('scroll', updateDirection);
      window.removeEventListener('resize', updateDirection);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [scrollableRef]);

  if (!direction) return null;

  return (
    <div className="admin-scroll-cue pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2" aria-hidden="true">
      <span className={`admin-scroll-cue__mouse ${direction === 'up' ? 'admin-scroll-cue__mouse--up' : ''}`}>
        <span className="admin-scroll-cue__dot" />
      </span>
      <span className="admin-scroll-cue__label">{direction === 'up' ? 'Scroll Up' : 'Scroll Down'}</span>
    </div>
  );
}
