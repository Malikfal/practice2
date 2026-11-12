import { Link } from 'react-router';

import { SearchableSelect } from '../../../ui/FormField';
import {
  SETTINGS_SECTION_PATHS,
  joinClassNames,
  type SettingsSection,
} from './settingsUtils';

type Props = {
  activeSection: SettingsSection;
  onSectionChange: (_section: SettingsSection) => void;
};

const items: Array<{ section: SettingsSection; label: string; className?: string }> = [
  { section: 'billing', label: 'Подписка и платежи', className: 'mb-2' },
  { section: 'roles', label: 'Роли и права' },
  { section: 'workspace', label: 'Настройки рабочего пространства', className: 'mt-2' },
  { section: 'imports', label: 'Импорт', className: 'mt-2' },
];

export default function SettingsSidebar({ activeSection, onSectionChange }: Props) {
  return (
    <>
      <div className='rounded-xl border border-[#e3e9f3] bg-white p-2 text-[#1f3565] lg:hidden'>
        <SearchableSelect
          value={activeSection}
          onValueChange={(value) => {
            if (!value) return;
            onSectionChange(value as SettingsSection);
          }}
          options={items.map((item) => ({
            value: item.section,
            label: item.label,
          }))}
          searchable={false}
          placeholder='Выберите раздел настроек'
          className='h-11 rounded-xl border-[#c9d8f8] bg-[#edf2fb] pr-11 text-base font-semibold text-[#10275a] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#dce7ff]'
        />
      </div>

      <aside className='hidden h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white p-3 text-[#1f3565] lg:flex'>
        {items.map((item) => (
          <Link
            key={item.section}
            to={SETTINGS_SECTION_PATHS[item.section]}
            className={joinClassNames(
              item.className,
              'rounded-xl border px-3 py-3 text-left text-[14px] font-semibold transition-colors',
              activeSection === item.section
                ? 'border-[#c9d8f8] bg-[#edf2fb] text-[#10275a]'
                : 'border-[#e3e9f3] bg-white text-[#1f3565] hover:bg-[#fbfcff]',
            )}
            aria-current={activeSection === item.section ? 'page' : undefined}
            onClick={() => onSectionChange(item.section)}
          >
            {item.label}
          </Link>
        ))}
      </aside>
    </>
  );
}
