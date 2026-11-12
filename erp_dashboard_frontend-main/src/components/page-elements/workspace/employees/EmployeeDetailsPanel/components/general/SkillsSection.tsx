import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../../api/api';
import type { EmployeeProfileForm, Skill } from '../../../../../../../types/app';
import Button from '../../../../../../ui/Button';
import { Input } from '../../../../../../ui/FormField';

type Props = {
  employeeId: string;
  profileForm: EmployeeProfileForm;
  canEditProfile: boolean;
  onProfileFormChange: (_next: EmployeeProfileForm) => void;
};

function parseSkills(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item, index, array) => item !== '' && array.indexOf(item) === index);
}

function normalizeSkill(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export default function SkillsSection({
  employeeId,
  profileForm,
  canEditProfile,
  onProfileFormChange,
}: Props) {
  const [skillInput, setSkillInput] = useState('');
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const selectedSkills = parseSkills(profileForm.skills);
  const selectedSkillSet = useMemo(
    () => new Set(selectedSkills.map((skill) => skill.toLowerCase())),
    [selectedSkills],
  );

  const applySkills = (skills: string[]) => {
    onProfileFormChange({
      ...profileForm,
      employeeId,
      skills: skills.join(', '),
    });
  };

  const handleAddSkill = (value: string) => {
    const normalized = normalizeSkill(value);
    if (!normalized) return;

    if (selectedSkillSet.has(normalized.toLowerCase())) {
      setSkillInput('');
      return;
    }

    applySkills([...selectedSkills, normalized]);
    setSkillInput('');
  };

  const handleRemoveSkill = (skill: string) => {
    applySkills(selectedSkills.filter((item) => item !== skill));
  };

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const skills = await api.workspace.skills.getMany({
          search: skillInput.trim() || undefined,
        });

        if (!ignore) {
          setAvailableSkills(Array.isArray(skills) ? skills : []);
        }
      } catch (error) {
        if (!ignore) {
          toast.error(
            error instanceof Error ? error.message : 'Не удалось загрузить компетенции.',
          );
        }
      }
    }, 200);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [skillInput]);

  const skillSuggestions = availableSkills.filter(
    (skill) => !selectedSkillSet.has(skill.name.trim().toLowerCase()),
  );

  return (
    <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 sm:p-4'>
      <div>
        <h3 className='text-[18px] leading-tight font-semibold text-[#10275a] sm:text-[20px] sm:leading-none'>
          Компетенции
        </h3>
        <p className='mt-1 text-[13px] text-[#7e8fb4]'>
          Стек, с чем может и готов работать сотрудник
        </p>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-[13px] text-[#7a8aae]'>Добавленные компетенции:</span>
        {selectedSkills.length === 0 ? (
          <span className='text-xs text-[#9aa8c7]'>Компетенций пока нет</span>
        ) : (
          selectedSkills.map((skill) => (
            <span
              key={skill}
              className='inline-flex items-center gap-1.5 rounded-full border border-[#c9d8f8] bg-[#edf3ff] px-2.5 py-1 text-xs font-medium text-[#1f3565]'
            >
              {skill}
              <button
                type='button'
                onClick={() => handleRemoveSkill(skill)}
                disabled={!canEditProfile}
                className='grid size-4 place-items-center rounded-full text-[#7a8aae] transition-colors hover:bg-[#dbe6ff] hover:text-[#1f3565] disabled:cursor-not-allowed disabled:opacity-50'
                title='Удалить компетенцию'
              >
                <svg
                  viewBox='0 0 12 12'
                  className='size-2.5 fill-none stroke-current stroke-2'
                >
                  <path
                    d='M3 3l6 6M9 3l-6 6'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      <div className='grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center'>
        <span className='text-[13px] text-[#7a8aae]'>Добавить компетенцию:</span>
        <Input
          list='employee-skill-suggestions'
          value={skillInput}
          readOnly={!canEditProfile}
          onChange={(event) => setSkillInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAddSkill(skillInput);
            }
          }}
          placeholder='Введите новую компетенцию или выберите из списка'
          disabled={!canEditProfile}
          className='h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] placeholder:text-[#9aa8c7] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] sm:h-10 sm:text-[14px]'
        />
        <Button
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => handleAddSkill(skillInput)}
          disabled={!canEditProfile || normalizeSkill(skillInput) === ''}
          className='w-full md:w-auto'
        >
          Добавить
        </Button>
        <datalist id='employee-skill-suggestions'>
          {skillSuggestions.map((skill) => (
            <option key={skill.id} value={skill.name} />
          ))}
        </datalist>
      </div>
    </section>
  );
}
