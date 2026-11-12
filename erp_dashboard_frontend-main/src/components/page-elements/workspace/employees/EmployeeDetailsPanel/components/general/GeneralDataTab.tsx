import type {
  EmployeeProfileForm,
  RoleOption,
  User,
} from '../../../../../../../types/app';

import EmployeeStatusActions from './EmployeeStatusActions';
import AdditionalFieldsSection from './AdditionalFieldsSection';
import GeneralInfoSection from './GeneralInfoSection';
import SkillsSection from './SkillsSection';
import SocialLinksSection from './SocialLinksSection';

type Props = {
  employee: User;
  profileForm: EmployeeProfileForm;
  roleOptions: RoleOption[];
  projectStats: {
    total: number;
    active: number;
  };
  isUpdating: boolean;
  canEditProfile: boolean;
  canEditPosition?: boolean;
  canEditRole?: boolean;
  showPositionField?: boolean;
  showRoleField?: boolean;
  showWorkMetaFields?: boolean;
  positionSuggestions?: string[];
  onProfileFormChange: (_next: EmployeeProfileForm) => void;
  onUpdateEmployee: () => void;
};

export default function GeneralDataTab({
  employee,
  profileForm,
  roleOptions,
  projectStats,
  isUpdating,
  canEditProfile,
  canEditPosition = canEditProfile,
  canEditRole = canEditProfile,
  showPositionField = true,
  showRoleField = true,
  showWorkMetaFields = true,
  positionSuggestions,
  onProfileFormChange,
  onUpdateEmployee,
}: Props) {
  return (
    <div className='grid gap-4'>
      <GeneralInfoSection
        employee={employee}
        profileForm={profileForm}
        roleOptions={roleOptions}
        projectStats={projectStats}
        canEditProfile={canEditProfile}
        canEditPosition={canEditPosition}
        canEditRole={canEditRole}
        showPositionField={showPositionField}
        showRoleField={showRoleField}
        showWorkMetaFields={showWorkMetaFields}
        positionSuggestions={positionSuggestions}
        onProfileFormChange={onProfileFormChange}
      />

      <SocialLinksSection
        employeeId={employee.id}
        profileForm={profileForm}
        canEditProfile={canEditProfile}
        onProfileFormChange={onProfileFormChange}
      />

      <AdditionalFieldsSection
        profileForm={profileForm}
        canEditProfile={canEditProfile}
        onProfileFormChange={onProfileFormChange}
      />

      <SkillsSection
        employeeId={employee.id}
        profileForm={profileForm}
        canEditProfile={canEditProfile}
        onProfileFormChange={onProfileFormChange}
      />

      {canEditProfile ? (
        <EmployeeStatusActions
          isUpdating={isUpdating}
          onUpdateEmployee={onUpdateEmployee}
        />
      ) : null}
    </div>
  );
}
