import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/api';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function IndividualTariffModal({ isOpen, onClose }: Props) {
  const [employeesCount, setEmployeesCount] = useState<string>('');
  const [periodMonths, setPeriodMonths] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const count = employeesCount.trim() === '' ? null : Number(employeesCount);
    const period = periodMonths.trim() === '' ? null : Number(periodMonths);

    if (count !== null && (isNaN(count) || count < 51)) {
      toast.error('Количество сотрудников должно быть не менее 51');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await api.workspace.billing.requestIndividualTariff(count, period);
      toast.success(response.message || 'Заявка отправлена');
      onClose();
      setEmployeesCount('');
      setPeriodMonths('');
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : 'Ошибка при отправке заявки',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm sm:px-6'
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className='relative w-full max-w-md rounded-2xl bg-white shadow-xl shadow-slate-900/10'
      >
        <div className='flex items-center justify-between border-b border-[#e3e9f3] px-6 py-4'>
          <h2 className='text-lg font-bold text-[#1f3565]'>
            Заявка на индивидуальный тариф
          </h2>
        </div>

        <form onSubmit={handleSubmit} className='p-6'>
          <div className='mb-4'>
            <label className='mb-1.5 block text-sm font-semibold text-[#1f3565]'>
              Желаемое количество сотрудников
            </label>
            <input
              type='text'
              min='51'
              className='w-full rounded-xl border border-[#c9d8f8] bg-white px-3.5 py-2.5 text-sm font-medium text-[#10275a] placeholder-[#94a3b8] shadow-sm transition-all focus:border-[#2d6ff7] focus:ring-4 focus:ring-[#2d6ff7]/10'
              placeholder='Оставьте пустым для безлимита'
              value={employeesCount}
              onChange={(e) => setEmployeesCount(e.target.value)}
            />
            <p className='mt-2 text-xs text-[#5f73a3]'>
              Минимальное количество сотрудников — 51. Если нужен безлимит, оставьте поле
              пустым.
            </p>
          </div>

          <div className='mb-4'>
            <label className='mb-1.5 block text-sm font-semibold text-[#1f3565]'>
              Желаемый период
            </label>
            <select
              className='w-full rounded-xl border border-[#c9d8f8] bg-white px-3.5 py-2.5 text-sm font-medium text-[#10275a] placeholder-[#94a3b8] shadow-sm transition-all focus:border-[#2d6ff7] focus:ring-4 focus:ring-[#2d6ff7]/10'
              value={periodMonths}
              onChange={(e) => setPeriodMonths(e.target.value)}
            >
              <option value=''>Не указан</option>
              <option value='1'>1 месяц</option>
              <option value='3'>3 месяца</option>
              <option value='6'>6 месяцев</option>
              <option value='12'>12 месяцев</option>
            </select>
          </div>

          <div className='mt-8 flex items-center gap-3'>
            <button
              type='button'
              onClick={onClose}
              disabled={isSubmitting}
              className='flex-1 rounded-xl bg-[#f3f7ff] py-2.5 text-sm font-semibold text-[#1f3565] transition-colors hover:bg-[#e3e9f3]'
            >
              Отмена
            </button>
            <button
              type='submit'
              disabled={isSubmitting}
              className='flex-1 rounded-xl bg-[#2d6ff7] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245fd8] disabled:opacity-50'
            >
              {isSubmitting ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
