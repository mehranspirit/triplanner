import { type RefObject, useLayoutEffect, useState } from 'react';

export const useElementHeight = (
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) => {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      setHeight(null);
      return;
    }

    const syncHeight = () => {
      setHeight(element.getBoundingClientRect().height);
    };

    syncHeight();

    const observer = new ResizeObserver(syncHeight);
    observer.observe(element);

    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls invalidation via deps
  }, [ref, ...deps]);

  return height;
};
