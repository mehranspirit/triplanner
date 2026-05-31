import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export type MapSheetSnap = 'peek' | 'half' | 'full';

interface MapBottomSheetProps {
  snap: MapSheetSnap;
  onSnapChange: (snap: MapSheetSnap) => void;
  peekContent?: React.ReactNode;
  children: React.ReactNode;
}

const SNAP_ORDER: MapSheetSnap[] = ['peek', 'half', 'full'];

const SNAP_HEIGHT: Record<MapSheetSnap, string> = {
  peek: '5.75rem',
  half: '46vh',
  full: 'min(78vh, calc(100dvh - 12rem))',
};

const SNAP_LABEL: Record<MapSheetSnap, string> = {
  peek: 'collapsed',
  half: 'half height',
  full: 'full height',
};

const MapBottomSheet: React.FC<MapBottomSheetProps> = ({
  snap,
  onSnapChange,
  peekContent,
  children,
}) => {
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragStartSnap = useRef<MapSheetSnap>(snap);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setDragOffset(0);
  }, [snap]);

  const cycleSnap = useCallback(() => {
    const currentIndex = SNAP_ORDER.indexOf(snap);
    onSnapChange(SNAP_ORDER[(currentIndex + 1) % SNAP_ORDER.length]);
  }, [onSnapChange, snap]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStartY.current = event.clientY;
    dragStartSnap.current = snap;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion || dragStartY.current === null) return;
    setDragOffset(Math.max(-120, Math.min(160, event.clientY - dragStartY.current)));
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) return;

    const delta = event.clientY - dragStartY.current;
    dragStartY.current = null;

    if (prefersReducedMotion || Math.abs(delta) < 24) {
      cycleSnap();
    } else if (delta > 40) {
      const index = SNAP_ORDER.indexOf(dragStartSnap.current);
      onSnapChange(SNAP_ORDER[Math.max(0, index - 1)]);
    } else if (delta < -40) {
      const index = SNAP_ORDER.indexOf(dragStartSnap.current);
      onSnapChange(SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, index + 1)]);
    } else {
      cycleSnap();
    }

    setDragOffset(0);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 lg:hidden"
      role="region"
      aria-label="Trip itinerary sheet"
      aria-expanded={snap !== 'peek'}
    >
      <div
        className={cn(
          'pointer-events-auto flex flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl ease-out motion-reduce:transition-none',
          prefersReducedMotion ? '' : 'transition-[height] duration-300',
        )}
        style={{
          height: SNAP_HEIGHT[snap],
          transform: !prefersReducedMotion && dragOffset ? `translateY(${Math.max(0, dragOffset)}px)` : undefined,
        }}
      >
        <button
          type="button"
          className="flex w-full shrink-0 flex-col items-center px-4 pb-2 pt-3"
          aria-label={`Itinerary sheet, ${SNAP_LABEL[snap]}. Tap to change height.`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <span className="h-1.5 w-12 rounded-full bg-slate-300" aria-hidden="true" />
        </button>

        {snap === 'peek' && peekContent && (
          <div className="shrink-0 border-b border-slate-100 px-4 pb-3">
            {peekContent}
          </div>
        )}

        {snap !== 'peek' && (
          <div className="min-h-0 flex-1 overflow-y-auto px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] [--trip-timeline-sticky-top:0px] [--trip-timeline-sticky-top-md:0px]">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapBottomSheet;
