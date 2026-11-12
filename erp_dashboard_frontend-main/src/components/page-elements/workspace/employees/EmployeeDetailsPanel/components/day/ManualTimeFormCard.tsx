import type { FormEvent } from 'react';

import Button from '../../../../../../ui/Button';
import { Field, Input, SearchableSelect, Textarea } from '../../../../../../ui/FormField';
import type { ManualTimeForm, Project, Task } from '../../../../../../../types/app';

type Props = {
  manualTimeForm: ManualTimeForm;
  projects: Project[];
  maxDateTime: string;
  isLoadingProjectsAndEmployees: boolean;
  isAddingTime: boolean;
  isLoadingTasks: boolean;
  tasks: Task[];
  onFormChange: (_next: ManualTimeForm) => void;
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void;
  embedded?: boolean;
};

function buildTaskOptions(tasks: Task[]): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const seenTaskIds = new Set<string>();

  const addTask = (task: Task) => {
    if (seenTaskIds.has(task.id)) return;

    seenTaskIds.add(task.id);

    if (!task.is_draft) {
      options.push({
        value: task.id,
        label: task.title,
      });
    }

    task.subtasks?.forEach(addTask);
  };

  tasks.forEach((task) => addTask(task));

  return options;
}

export default function ManualTimeFormCard({
  manualTimeForm,
  projects,
  maxDateTime,
  isLoadingProjectsAndEmployees,
  isLoadingTasks,
  isAddingTime,
  tasks,
  onFormChange,
  onSubmit,
  embedded = false,
}: Props) {
  return (
    <section className={embedded ? 'h-full' : 'h-full overflow-auto'}>
      <div
        className={
          embedded
            ? 'max-w-4xl'
            : 'max-w-4xl rounded-xl border border-slate-200 bg-white p-4'
        }
      >
        {embedded ? null : (
          <h2 className='mb-2 text-sm font-semibold text-slate-800'>
            Добавление времени вручную
          </h2>
        )}
        <form onSubmit={onSubmit} className='grid gap-2.5'>
          <div className='grid gap-2.5 md:grid-cols-2'>
            <Field label='Проект'>
              <SearchableSelect
                value={manualTimeForm.project_id}
                onValueChange={(nextValue) =>
                  onFormChange({
                    ...manualTimeForm,
                    project_id: nextValue,
                    task_id: '',
                    task_title: '',
                  })
                }
                options={projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                }))}
                placeholder='Выберите проект'
                className='h-10'
                required
                isLoading={isLoadingProjectsAndEmployees}
              />
            </Field>
            <Field label='Задача'>
              <SearchableSelect
                value={manualTimeForm.task_id}
                onValueChange={(nextValue) =>
                  onFormChange({
                    ...manualTimeForm,
                    task_id: nextValue,
                    task_title: nextValue ? '' : manualTimeForm.task_title,
                  })
                }
                onInputValueChange={(nextInput) =>
                  onFormChange({
                    ...manualTimeForm,
                    task_id: '',
                    task_title: nextInput,
                  })
                }
                options={buildTaskOptions(tasks)}
                placeholder='Выберите задачу или введите новую'
                className='h-10'
                isLoading={isLoadingTasks}
              />
            </Field>
            <Field label='Начало'>
              <Input
                type='datetime-local'
                className='h-10'
                value={manualTimeForm.started_at}
                max={maxDateTime}
                onChange={(e) =>
                  onFormChange({ ...manualTimeForm, started_at: e.target.value })
                }
                required
              />
            </Field>
            <Field label='Окончание'>
              <Input
                type='datetime-local'
                className='h-10'
                value={manualTimeForm.ended_at}
                max={maxDateTime}
                onChange={(e) =>
                  onFormChange({ ...manualTimeForm, ended_at: e.target.value })
                }
                required
              />
            </Field>
          </div>
          <div className='grid gap-2.5'>
            <Field label='Комментарий'>
              <Textarea
                className='h-24 resize-none'
                style={{ resize: 'none' }}
                value={manualTimeForm.note}
                onChange={(e) =>
                  onFormChange({ ...manualTimeForm, note: e.target.value })
                }
              />
            </Field>
            <Button
              type='submit'
              className='h-10 px-4 justify-self-start'
              disabled={isAddingTime}
              variant={isAddingTime ? 'secondary' : 'primary'}
            >
              {isAddingTime ? 'Добавление времени...' : 'Добавить время'}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
