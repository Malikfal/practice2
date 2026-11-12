import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../api/api';
import EmployeeDetailsPanel from '../../components/page-elements/workspace/employees/EmployeeDetailsPanel';
import { useAppControllerContext } from '../../context/AppControllerContext';
import { isValidPhone } from '../../utils/formatters';
import {
  arePayloadsEqual,
  fieldsToPayload,
  payloadToFields,
} from '../../utils/employeePayloadFields';
import type { EmployeeProfileForm, Project, User } from '../../types/app';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createProfileFormForCurrentUser(user: User): EmployeeProfileForm {
  return {
    employeeId: user.id,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    role: user.role || '',
    role_id: user.role || '',
    position: user.position || '',
    birthday: user.birthday || '',
    phone: user.phone || '',
    socials: {
      additional_email: user.socials?.additional_email || '',
      additional_phone: user.socials?.additional_phone || '',
      max_url: user.socials?.max_url || '',
      vk_url: user.socials?.vk_url || '',
      telegram_url: user.socials?.telegram_url || '',
    },
    skills: user.skills || '',
    payload_fields: payloadToFields(user.payload),
    status: user.status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    archived_at: user.archived_at || '',
  };
}

export default function HomePage() {
  const { user, passwordForm, setPasswordForm, onChangePassword, isUpdatingPassword } =
    useAppControllerContext();
  const [projects] = useState<Project[]>([]);
  const [employee, setEmployee] = useState<User | null>(user);
  const [profileForm, setProfileForm] = useState<EmployeeProfileForm | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    setEmployee(user);
    setProfileForm(user ? createProfileFormForCurrentUser(user) : null);
  }, [user]);

  const activeEmployee = useMemo(() => employee ?? user ?? null, [employee, user]);

  if (!activeEmployee || !profileForm) {
    return null;
  }

  const onUpdateEmployee = async () => {
    const payloadResult = fieldsToPayload(profileForm.payload_fields);
    const hasChanges =
      profileForm.first_name !== (activeEmployee.first_name || '') ||
      profileForm.last_name !== (activeEmployee.last_name || '') ||
      profileForm.position !== (activeEmployee.position || '') ||
      profileForm.birthday !== (activeEmployee.birthday || '') ||
      profileForm.phone !== (activeEmployee.phone || '') ||
      profileForm.socials.additional_email !==
        (activeEmployee.socials?.additional_email || '') ||
      profileForm.socials.additional_phone !==
        (activeEmployee.socials?.additional_phone || '') ||
      profileForm.socials.max_url !== (activeEmployee.socials?.max_url || '') ||
      profileForm.socials.vk_url !== (activeEmployee.socials?.vk_url || '') ||
      profileForm.socials.telegram_url !== (activeEmployee.socials?.telegram_url || '') ||
      profileForm.skills !== (activeEmployee.skills || '') ||
      !arePayloadsEqual(payloadResult.payload, activeEmployee.payload);

    if (!hasChanges) {
      toast.message('Нет изменений для сохранения.');
      return;
    }

    if (payloadResult.hasMissingKeys) {
      toast.error('Укажите название для каждого дополнительного поля.');
      return;
    }

    if (profileForm.phone.trim() && !isValidPhone(profileForm.phone)) {
      toast.error('Введите корректный номер телефона.');
      return;
    }
    if (
      profileForm.socials.additional_phone?.trim() &&
      !isValidPhone(profileForm.socials.additional_phone)
    ) {
      toast.error('Введите корректный дополнительный номер телефона.');
      return;
    }
    if (
      profileForm.socials.additional_email?.trim() &&
      !isValidEmail(profileForm.socials.additional_email)
    ) {
      toast.error('Введите корректную дополнительную почту.');
      return;
    }

    try {
      setIsUpdatingProfile(true);
      const updated = await api.updateProfile({
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        birthday: profileForm.birthday.trim() || null,
        phone: profileForm.phone.trim() || null,
        socials: {
          additional_email: profileForm.socials.additional_email?.trim() || '',
          additional_phone: profileForm.socials.additional_phone?.trim() || '',
          max_url: profileForm.socials.max_url?.trim() || '',
          vk_url: profileForm.socials.vk_url?.trim() || '',
          telegram_url: profileForm.socials.telegram_url?.trim() || '',
        },
        skills: profileForm.skills.trim() || null,
        payload: payloadResult.payload,
      });

      setEmployee(updated);
      setProfileForm(createProfileFormForCurrentUser(updated));
      toast.success('Профиль обновлён.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Произошла ошибка.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <EmployeeDetailsPanel
      selectedEmployee={activeEmployee}
      profileForm={profileForm}
      roleOptions={[]}
      projects={projects}
      isUpdating={isUpdatingProfile}
      homePageMode
      initialTab='День сотрудника'
      canEditProfile
      passwordForm={passwordForm}
      isUpdatingPassword={isUpdatingPassword}
      onPasswordFormChange={setPasswordForm}
      onChangePassword={onChangePassword}
      showCloseButton={false}
      onProfileFormChange={setProfileForm}
      onUpdateEmployee={onUpdateEmployee}
      onRequestPasswordReset={() => null}
      onCloseEmployee={() => null}
    />
  );
}
