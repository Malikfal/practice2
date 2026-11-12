import { useEffect, useState, type CSSProperties, type RefObject } from 'react';

export default function useFinanceFilterDropdownStyle(
  anchorRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  preferredWidth = 440,
) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const margin = 12;
      const offset = 6;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(
        Math.max(rect.width, preferredWidth),
        Math.max(0, viewportWidth - margin * 2),
      );
      const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      const below = viewportHeight - rect.bottom - offset - margin;
      const above = rect.top - offset - margin;
      const openAbove = below < 320 && above > below;
      const availableHeight = Math.max(0, openAbove ? above : below);

      setStyle({
        position: 'fixed',
        top: openAbove ? undefined : rect.bottom + offset,
        bottom: openAbove ? viewportHeight - rect.top + offset : undefined,
        left,
        width,
        maxHeight: Math.min(480, availableHeight),
      });
    };

    const frame = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, isOpen, preferredWidth]);

  return style;
}
