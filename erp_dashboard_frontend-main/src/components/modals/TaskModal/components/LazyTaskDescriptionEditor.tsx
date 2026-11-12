import { lazy, Suspense, type ComponentProps } from 'react';

import Preloader from '../../../ui/Preloader';
import type TaskDescriptionEditorComponent from './TaskDescriptionEditor';

const TaskDescriptionEditor = lazy(() => import('./TaskDescriptionEditor'));

// Редактор на tiptap тяжёлый, поэтому грузится только когда открыта задача.
// Заглушка повторяет разметку редактора, чтобы карточка не прыгала.
export default function LazyTaskDescriptionEditor(
  props: ComponentProps<typeof TaskDescriptionEditorComponent>,
) {
  return (
    <Suspense
      fallback={
        <div className='flex h-full min-h-[320px] min-w-0 max-w-full flex-1 flex-col gap-2 overflow-hidden lg:min-h-0'>
          <span className='text-[13px] leading-tight font-medium text-slate-700'>
            Описание
          </span>
          <div className='flex min-h-0 flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white'>
            <Preloader />
          </div>
        </div>
      }
    >
      <TaskDescriptionEditor {...props} />
    </Suspense>
  );
}
