import type {
  EmployeeAbsence,
  EmployeeAbsenceCalendarDay,
  EmployeeAbsenceType,
} from '../../../../../../../types/app';

export type AbsenceModalState =
  | { mode: 'create'; absence: null; initialDate?: string }
  | { mode: 'edit'; absence: EmployeeAbsence; initialDate?: string };

export type CalendarGridDay = EmployeeAbsenceCalendarDay & {
  inMonth: boolean;
};

export type DayTooltipState = {
  day: EmployeeAbsenceCalendarDay;
  absence: EmployeeAbsence | null;
  top: number;
  left: number;
};

export type AbsenceSummary = Record<EmployeeAbsenceType, number> & {
  total: number;
};
