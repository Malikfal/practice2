import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function HintToolTip({
  content,
  className,
  trigger,
  triggerClassName,
}: {
  content: ReactNode;
  className?: string;
  /** Своя кнопка вместо "?", например подпись, по которой открывается список. */
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleClick = () => {
    clearTimeout(hoverTimeout.current);
    if (!isOpen) updateTooltipPosition();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    return () => clearTimeout(hoverTimeout.current);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => setIsOpen(false);

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [isOpen]);

  const handleMouseEnter = () => {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      updateTooltipPosition();
      setIsOpen(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setIsOpen(false), 150);
  };

  const updateTooltipPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const pad = 12;
    const maxWidth = 300;
    const viewportWidth = window.innerWidth;

    const top = rect.bottom + 8;
    let left = rect.left;

    if (left + maxWidth > viewportWidth - pad) {
      left = viewportWidth - pad - maxWidth;
    }

    if (left < pad) {
      left = pad;
    }

    setTooltipStyle({
      position: 'fixed' as const,
      top,
      left,
      zIndex: 9999,
    });
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        type='button'
        className={
          trigger
            ? (triggerClassName ?? '')
            : 'grid size-4.5 shrink-0 place-items-center rounded-full border border-[#d7e1f1] text-[11px] font-bold leading-none text-[#7e8fb4] transition-colors hover:border-[#2d6ff7] hover:bg-[#edf3ff] hover:text-[#2d6ff7]'
        }
        onClick={handleClick}
        aria-label={trigger ? undefined : 'Подсказка'}
        aria-expanded={trigger ? isOpen : undefined}
      >
        {trigger ?? '?'}
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={tooltipRef}
              style={tooltipStyle}
              className='w-max max-w-75 rounded-xl border border-[#e3e9f3] bg-white px-3 py-2 text-[12px] leading-relaxed font-semibold text-[#1f3565] shadow-lg shadow-slate-900/10'
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
