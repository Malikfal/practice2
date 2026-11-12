import { useEffect } from 'react';

export default function ImageViewerModal({
  isOpen,
  src,
  alt = '',
  onClose,
}: {
  isOpen: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return (
    <div
      className='fixed inset-0 z-1100 grid place-items-center bg-slate-950/75 p-4'
      role='dialog'
      aria-modal='true'
      aria-label={alt || 'Изображение'}
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className='max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl shadow-black/40'
        onClick={(event) => event.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}
