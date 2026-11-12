import { useMemo, useState } from 'react';

import Button from '../../../../ui/Button';
import { Field, MultiSelect } from '../../../../ui/FormField';
import type {
  KnowledgeBaseArticle,
  KnowledgeBaseFolder,
  RoleOption,
  User,
} from '../../../../../types/app';
import { formatName } from '../../../../../utils/formatters';
import KnowledgeBaseModalShell from './KnowledgeBaseModalShell';

type Props = {
  folder: KnowledgeBaseFolder | null;
  article?: KnowledgeBaseArticle | null;
  employees: User[];
  roleOptions: RoleOption[];
  onClose: () => void;
  onSubmit: (_payload: { roles: string[]; user_ids: string[] }) => void;
};

export default function KnowledgeBaseAccessDialog({
  folder,
  article = null,
  employees,
  roleOptions,
  onClose,
  onSubmit,
}: Props) {
  const target = article ?? folder;
  const isArticle = Boolean(article);
  const [roles, setRoles] = useState<string[]>(
    () => target?.access?.roles?.map((role) => role.value) ?? [],
  );
  const [userIds, setUserIds] = useState<string[]>(
    () => target?.access?.users?.map((user) => user.id) ?? [],
  );
  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: `${formatName(employee)}${employee.email ? `, ${employee.email}` : ''}`,
      })),
    [employees],
  );
  const selectedAccessSummary = useMemo(() => {
    if (!roles.length && !userIds.length) {
      if (!isArticle) return 'Доступно всем пользователям компании.';

      return article?.folder_id
        ? 'Без индивидуальных ограничений. Доступ определяется папкой.'
        : 'Доступно всем пользователям компании.';
    }

    const roleLabels = roles.map(
      (roleValue) =>
        roleOptions.find((option) => option.value === roleValue)?.label ?? roleValue,
    );
    const userLabels = userIds.map((userId) => {
      const employee = employees.find((item) => item.id === userId);
      const accessUser = target?.access?.users?.find((item) => item.id === userId);

      if (employee) return formatName(employee);
      if (accessUser)
        return [accessUser.name, accessUser.last_name].filter(Boolean).join(' ');

      return userId;
    });
    const summaryParts = [
      roleLabels.length ? `Роли: ${roleLabels.join(', ')}` : '',
      userLabels.length ? `Пользователи: ${userLabels.join(', ')}` : '',
    ].filter(Boolean);

    return summaryParts.join('. ');
  }, [article?.folder_id, employees, isArticle, roleOptions, roles, target, userIds]);

  if (!target) return null;

  const title = isArticle ? article?.title || 'Без названия' : folder?.name;

  return (
    <KnowledgeBaseModalShell
      title={`Доступы: ${title}`}
      description={
        isArticle
          ? 'Очистите роли и пользователей, чтобы статья наследовала доступ папки или была доступна всей компании без папки.'
          : 'Очистите роли и пользователей, чтобы папка была доступна всем пользователям компании.'
      }
      maxWidthClassName='max-w-lg'
      allowOverflow
      onClose={onClose}
    >
      <form
        className='grid gap-4'
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ roles, user_ids: userIds });
        }}
      >
        <div className='rounded-lg border border-[#d9e2f2] bg-[#f8fbff] px-3 py-2 text-[12px] leading-relaxed text-[#5d7098]'>
          {selectedAccessSummary}
        </div>
        <Field label='Роли'>
          <MultiSelect
            values={roles}
            onValuesChange={setRoles}
            options={roleOptions}
            placeholder='Выберите роли'
          />
        </Field>
        <Field label='Пользователи'>
          <MultiSelect
            values={userIds}
            onValuesChange={setUserIds}
            options={employeeOptions}
            searchable
            placeholder='Выберите сотрудников'
            emptyText='Сотрудники не загружены'
          />
        </Field>
        <Button type='submit'>Сохранить доступы</Button>
      </form>
    </KnowledgeBaseModalShell>
  );
}
