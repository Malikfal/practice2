import Button from '../ui/Button';
import type { AppMenuItem } from '../../types/app';

export default function WorkspaceTabs({
  pages,
  activePage,
  onChange,
}: {
  pages: AppMenuItem[];
  activePage: string | null;
  onChange: (_pageId: string) => void;
}) {
  return (
    <div className='flex flex-wrap gap-2'>
      {pages.map((page) => (
        <Button
          key={page.id}
          type='button'
          variant='tab'
          className={
            activePage === page.id ? 'bg-blue-200 text-blue-900 hover:bg-blue-200' : ''
          }
          onClick={() => onChange(page.id)}
        >
          {page.label}
        </Button>
      ))}
    </div>
  );
}
