import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

interface FileInputProps {
  onFileSelect: (_file: File) => void;
  acceptedFormats?: string[];
  required?: boolean;
  disabled?: boolean;
}

export default function FileInput({
  onFileSelect,
  acceptedFormats = ['*/*'],
  required = false,
  disabled = false,
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // проверка формата файла
  const validateFile = (file: File): boolean => {
    if (!acceptedFormats || acceptedFormats.length === 0) {
      return true;
    }

    const isValid = acceptedFormats.some((format) => {
      if (format.startsWith('.')) {
        const ext = format.toLowerCase();
        const fileExt = file.name.toLowerCase().slice(-ext.length);
        return fileExt === ext;
      }
      if (format.includes('/')) {
        return file.type === format || file.type.startsWith(format.split('/')[0] + '/');
      }

      return false;
    });

    if (!isValid) {
      const formats = acceptedFormats
        .map((f) => (f.startsWith('.') ? f : f.split('/')[1]))
        .join(', ');
      setError(`Выберите файл формата: ${formats}`);
      return false;
    }

    setError(null);
    return true;
  };

  // обработка выбранного файла
  const handleFile = (file: File) => {
    if (disabled) return;

    if (!validateFile(file)) {
      return;
    }

    setFileName(file.name);
    setError(null);
    onFileSelect(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  // drag events
  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClick = () => {
    if (disabled || !inputRef.current) return;
    inputRef.current.click();
  };

  // Зона работает как кнопка: Tab переводит на неё фокус, Enter и пробел открывают выбор файла.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className='w-full'>
      <div
        role='button'
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-label={
          fileName
            ? `Выбран файл ${fileName}. Нажмите, чтобы выбрать другой`
            : 'Выбрать файл для загрузки'
        }
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          w-full rounded-lg border-2 px-4 py-8 text-center cursor-pointer
          outline-none focus-visible:ring-2 focus-visible:ring-[#2d6ff7] focus-visible:ring-offset-2
          transition-all duration-200
          ${
            disabled
              ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
              : isDragging
                ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
          }
          ${required && !fileName ? 'border-red-300' : ''}
        `}
      >
        <input
          ref={inputRef}
          type='file'
          tabIndex={-1}
          className='hidden'
          onChange={handleChange}
          accept={acceptedFormats?.join(',')}
          required={required}
          disabled={disabled}
        />

        {fileName ? (
          <div className='flex items-center justify-center gap-2'>
            <img src='/icons/file-icon_blue.svg' alt='' className='w-10.5' />
            <div className='text-left'>
              <p className='font-medium text-gray-900'>{fileName}</p>
              <p className='text-sm text-gray-500'>Файл выбран</p>
            </div>
          </div>
        ) : (
          <div className='flex flex-col items-center gap-2'>
            <img src='/icons/file-icon.svg' alt='' className='w-7.5' />
            <p className='font-medium text-gray-700'>
              Перетащите файл сюда или нажмите для выбора
            </p>
            <p className='text-sm text-gray-500'>
              {acceptedFormats && acceptedFormats.length > 0
                ? `Формат: ${acceptedFormats.join(', ')}`
                : 'Поддерживаются все файлы'}
            </p>
          </div>
        )}
      </div>

      {error && <p className='mt-2 text-sm text-red-600'>{error}</p>}
    </div>
  );
}
