import Button from '../../../../../../ui/Button';

type Props = {
  isUpdating: boolean;
  onUpdateEmployee: () => void;
};

export default function EmployeeStatusActions({ isUpdating, onUpdateEmployee }: Props) {
  return (
    <div className='flex flex-wrap items-center justify-end gap-3'>
      <Button
        type='button'
        variant='secondary'
        disabled={isUpdating}
        className='min-h-11 w-full rounded-xl border-transparent! bg-[#2d6ff7]! px-5 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#2d6ff7]! disabled:text-white! disabled:opacity-80 sm:h-10 sm:min-h-0 sm:w-auto'
        onClick={onUpdateEmployee}
      >
        {isUpdating ? 'Сохранение...' : 'Сохранить изменения'}
      </Button>
    </div>
  );
}
