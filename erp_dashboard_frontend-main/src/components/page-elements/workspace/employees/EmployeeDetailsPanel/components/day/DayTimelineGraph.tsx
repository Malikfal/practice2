import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';

import type { TimelineSegment } from '../../../../../../../types/app';
import {
  formatDurationHms,
  formatTimeRangeLocal,
  toDateFromApiTime,
} from '../../../../../../../utils/formatters';

import {
  HOURS,
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  formatSegmentTask,
} from './dayTimelineUtils';

type Props = {
  segments: TimelineSegment[];
  dayStartIso: string;
  dayEndIso: string;
  canViewSegmentDetails: boolean;
  onSegmentClick?: (_segment: TimelineSegment) => void;
};

const segmentStyles = [
  'border-[#93c5fd] bg-linear-to-r from-[#2d6ff7] to-[#5ca5ff]',
  'border-[#86efac] bg-linear-to-r from-[#22c55e] to-[#38d97b]',
  'border-[#d8b4fe] bg-linear-to-r from-[#8b5cf6] to-[#c084fc]',
  'border-[#fbcfe8] bg-linear-to-r from-[#ec4899] to-[#f472b6]',
];

const MIN_TIME_LABEL_WIDTH_PX = 36;
const TIME_MARKER_INTERVALS = [5, 10, 15, 30, 60] as const;

export default function DayTimelineGraph({
  segments,
  dayStartIso,
  dayEndIso,
  canViewSegmentDetails,
  onSegmentClick,
}: Props) {
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [timeMarkerInterval, setTimeMarkerInterval] = useState<number>(60);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const dragStateRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const [hoveredSegment, setHoveredSegment] = useState<{
    segment: TimelineSegment;
    x: number;
    y: number;
  } | null>(null);

  const timelineBounds = useMemo(() => {
    const startMs = new Date(dayStartIso).getTime();
    const endMs = new Date(dayEndIso).getTime();
    const durationMs = Math.max(endMs - startMs, 1);

    return { startMs, durationMs };
  }, [dayEndIso, dayStartIso]);

  const positionedSegments = useMemo(
    () =>
      segments.map((segment) => {
        const startMs = toDateFromApiTime(segment.clamped_started_at).getTime();
        const endMs = toDateFromApiTime(segment.clamped_ended_at).getTime();
        const left =
          ((startMs - timelineBounds.startMs) / timelineBounds.durationMs) * 100;
        const width = ((endMs - startMs) / timelineBounds.durationMs) * 100;

        return {
          ...segment,
          left,
          width,
        };
      }),
    [segments, timelineBounds.durationMs, timelineBounds.startMs],
  );

  const timelineWidth = `${zoomPercent}%`;
  const timeMarkers = useMemo(
    () =>
      Array.from({ length: (24 * 60) / timeMarkerInterval }, (_, index) => {
        const totalMinutes = index * timeMarkerInterval;

        return {
          totalMinutes,
          label: `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(
            totalMinutes % 60,
          ).padStart(2, '0')}`,
        };
      }),
    [timeMarkerInterval],
  );

  useLayoutEffect(() => {
    const timeline = timelineRef.current;

    if (!timeline) return;

    const updateMarkerInterval = () => {
      const timelineWidthPx = timeline.getBoundingClientRect().width;
      const nextInterval =
        TIME_MARKER_INTERVALS.find(
          (interval) =>
            timelineWidthPx / ((24 * 60) / interval) >= MIN_TIME_LABEL_WIDTH_PX,
        ) ?? 60;

      setTimeMarkerInterval((currentInterval) =>
        currentInterval === nextInterval ? currentInterval : nextInterval,
      );
    };

    const resizeObserver = new ResizeObserver(updateMarkerInterval);
    resizeObserver.observe(timeline);

    return () => resizeObserver.disconnect();
  }, []);

  const applyZoom = (nextZoom: number, clientX?: number) => {
    const container = timelineScrollRef.current;
    const clampedZoom = Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, nextZoom));

    if (!container || clampedZoom === zoomPercent) {
      setZoomPercent(clampedZoom);
      return;
    }

    const previousScrollWidth = container.scrollWidth;
    const relativeX =
      typeof clientX === 'number'
        ? clientX - container.getBoundingClientRect().left + container.scrollLeft
        : container.scrollLeft + container.clientWidth / 2;
    const anchorRatio = previousScrollWidth > 0 ? relativeX / previousScrollWidth : 0;

    setZoomPercent(clampedZoom);

    window.requestAnimationFrame(() => {
      const nextScrollWidth = container.scrollWidth;
      const nextAnchor = nextScrollWidth * anchorRatio;
      container.scrollLeft = Math.max(0, nextAnchor - container.clientWidth / 2);
    });
  };

  const handleTimelineWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dominantDelta =
      Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    const direction = dominantDelta > 0 ? -50 : 50;
    applyZoom(zoomPercent + direction, event.clientX);
  };

  const handleTimelineMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!timelineScrollRef.current) return;

    dragStateRef.current = {
      startX: event.clientX,
      startScrollLeft: timelineScrollRef.current.scrollLeft,
    };
    setIsDraggingTimeline(true);
    hasDraggedRef.current = false;
    setHoveredSegment(null);
  };

  const handleTimelineMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!timelineScrollRef.current || !dragStateRef.current) return;

    const deltaX = event.clientX - dragStateRef.current.startX;

    if (Math.abs(deltaX) > 4) {
      hasDraggedRef.current = true;
    }

    timelineScrollRef.current.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
  };

  const stopTimelineDragging = () => {
    dragStateRef.current = null;
    setIsDraggingTimeline(false);
  };

  return (
    <>
      <div className='grid min-w-0 gap-2'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3'>
          <p className='text-sm text-slate-500'>Масштаб таймлайна</p>
          <div className='flex min-w-0 items-center gap-3'>
            <input
              type='range'
              min={String(MIN_ZOOM_PERCENT)}
              max={String(MAX_ZOOM_PERCENT)}
              step='50'
              value={zoomPercent}
              onChange={(event) => applyZoom(Number(event.target.value))}
              className='min-w-0 flex-1 accent-sky-500 sm:w-36 sm:flex-none'
            />
            <span className='w-12 text-right text-sm font-semibold text-slate-800'>
              {zoomPercent}%
            </span>
          </div>
        </div>
        <div
          ref={timelineScrollRef}
          className={`min-w-0 overflow-x-auto overscroll-none pb-1 ${
            isDraggingTimeline ? 'cursor-grabbing select-none' : 'cursor-grab'
          }`}
          onWheelCapture={handleTimelineWheel}
          onWheel={handleTimelineWheel}
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={handleTimelineMouseMove}
          onMouseUp={stopTimelineDragging}
          onMouseLeave={stopTimelineDragging}
        >
          <div ref={timelineRef} style={{ width: timelineWidth, minWidth: '1000px' }}>
            <div className='flex'>
              {timeMarkers.map((marker) => (
                <div
                  key={marker.totalMinutes}
                  className='min-w-0 flex-1 text-[11px] font-medium text-slate-500'
                >
                  {marker.label}
                </div>
              ))}
            </div>

            <div className='relative mt-2 h-18 overflow-hidden rounded-xl border border-[#e3e9f3] bg-white'>
              <div className='pointer-events-none absolute inset-0 flex'>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className='h-full min-w-0 flex-1 border-l border-slate-200/80 first:border-l-0'
                  />
                ))}
              </div>
              {timeMarkerInterval < 60 ? (
                <div className='pointer-events-none absolute inset-0 flex'>
                  {timeMarkers.map((marker) => (
                    <div
                      key={marker.totalMinutes}
                      className='h-full min-w-0 flex-1 border-l border-sky-100/80 first:border-l-0'
                    />
                  ))}
                </div>
              ) : null}

              {positionedSegments.map((segment, index) => (
                <div
                  key={segment.id}
                  className='absolute top-2 bottom-2 min-w-8'
                  style={{
                    left: `${segment.left}%`,
                    width: `${segment.width}%`,
                  }}
                  onMouseEnter={(event: ReactMouseEvent<HTMLDivElement>) => {
                    setHoveredSegment({
                      segment,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  onMouseMove={(event: ReactMouseEvent<HTMLDivElement>) => {
                    setHoveredSegment({
                      segment,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  onMouseLeave={() => setHoveredSegment(null)}
                  onClick={() => {
                    if (hasDraggedRef.current) return;
                    onSegmentClick?.(segment);
                  }}
                >
                  <div
                    className={`flex h-full cursor-pointer items-start overflow-hidden rounded-lg border px-2 py-1 text-[12px] font-semibold text-white shadow-[0_10px_24px_-18px_rgba(45,111,247,0.9)] transition-opacity hover:opacity-90 ${
                      segmentStyles[index % segmentStyles.length]
                    }`}
                    title={`${segment.project_name || '—'} - ${segment.task_name || '—'}`}
                  >
                    <span className='truncate'>
                      {segment.project_name || segment.task_name || 'Сегмент'}
                    </span>
                  </div>
                </div>
              ))}

              {!segments.length ? (
                <div className='absolute inset-0 grid place-items-center text-sm text-slate-500'>
                  За выбранный день у сотрудника нет отработанных сегментов.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {hoveredSegment ? (
        <div
          className='pointer-events-none fixed z-80 w-64 rounded-xl border border-[#e3e9f3] bg-white p-2.5 text-xs text-slate-700 shadow-xl shadow-slate-900/10'
          style={{
            left: Math.min(hoveredSegment.x + 16, window.innerWidth - 280),
            top: Math.max(hoveredSegment.y - 16, 16),
          }}
        >
          <div className='grid gap-1.5'>
            <div className='grid gap-0.5'>
              <span className='text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase'>
                Проект
              </span>
              <p className='font-semibold text-slate-900'>
                {hoveredSegment.segment.project_name || '—'}
              </p>
            </div>
            <div className='grid gap-0.5'>
              <span className='text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase'>
                Задача
              </span>
              <p className='font-semibold text-slate-900'>
                {formatSegmentTask(hoveredSegment.segment, canViewSegmentDetails)}
              </p>
            </div>
            <div className='grid gap-0.5'>
              <span className='text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase'>
                Время
              </span>
              <p className='text-slate-600'>
                {formatTimeRangeLocal(
                  hoveredSegment.segment.clamped_started_at,
                  hoveredSegment.segment.clamped_ended_at,
                )}
              </p>
            </div>
            <div className='grid gap-0.5'>
              <span className='text-[10px] font-bold tracking-[0.08em] text-slate-500 uppercase'>
                Сегмент
              </span>
              <p className='font-semibold text-slate-900'>
                {formatDurationHms(hoveredSegment.segment.duration_seconds)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
