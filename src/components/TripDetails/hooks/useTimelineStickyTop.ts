import { type RefObject, useLayoutEffect, useState } from 'react';

export interface StickyChromeOffsets {
  /** Live viewport Y of the toolbar bottom edge — use for day strip sticky top. */
  toolbarBottom: number;
  /** Live viewport Y below toolbar + day strip — use for timeline day headers. */
  timelineStickyTop: number;
}

const emptyOffsets: StickyChromeOffsets = { toolbarBottom: 0, timelineStickyTop: 0 };

/**
 * Tracks live sticky chrome edges while scrolling so the day strip and timeline
 * headers stay flush beneath the toolbar instead of using a stale height guess.
 */
export const useStickyChromeOffsets = (
  toolbarRef: RefObject<HTMLElement | null>,
  dayStripRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[] = [],
): StickyChromeOffsets => {
  const [offsets, setOffsets] = useState<StickyChromeOffsets>(emptyOffsets);

  useLayoutEffect(() => {
    if (!enabled) {
      setOffsets(emptyOffsets);
      return;
    }

    let frameId = 0;

    const sync = () => {
      const toolbar = toolbarRef.current;
      if (!toolbar) {
        setOffsets(emptyOffsets);
        return;
      }

      const toolbarBottom = Math.max(0, Math.round(toolbar.getBoundingClientRect().bottom));
      let timelineStickyTop = toolbarBottom;
      const dayStrip = dayStripRef.current;
      if (dayStrip) {
        timelineStickyTop = Math.max(timelineStickyTop, Math.round(dayStrip.getBoundingClientRect().bottom));
      }

      setOffsets({ toolbarBottom, timelineStickyTop });
    };

    const scheduleSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(sync);
    };

    scheduleSync();

    const toolbar = toolbarRef.current;
    const dayStrip = dayStripRef.current;
    const observer = new ResizeObserver(scheduleSync);
    if (toolbar) observer.observe(toolbar);
    if (dayStrip) observer.observe(dayStrip);

    window.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync);
    window.visualViewport?.addEventListener('resize', scheduleSync);
    window.visualViewport?.addEventListener('scroll', scheduleSync);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      window.visualViewport?.removeEventListener('resize', scheduleSync);
      window.visualViewport?.removeEventListener('scroll', scheduleSync);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls invalidation via deps
  }, [toolbarRef, dayStripRef, enabled, ...deps]);

  return offsets;
};

/** @deprecated Use useStickyChromeOffsets */
export const useTimelineStickyTop = (
  toolbarRef: RefObject<HTMLElement | null>,
  dayStripRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[] = [],
) => useStickyChromeOffsets(toolbarRef, dayStripRef, enabled, deps).timelineStickyTop;
