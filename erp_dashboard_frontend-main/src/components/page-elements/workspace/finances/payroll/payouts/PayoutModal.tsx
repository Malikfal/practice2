import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import type {
  PayrollPayoutArticle,
  PayrollPayoutCreatePayload,
  PayrollPayoutEmployee,
  PayrollPayoutKind,
} from '../../../../../../types/payrollPayouts';
import Button from '../../../../../ui/Button';
import { Field, Input, Select } from '../../../../../ui/FormField';

import { PayoutModalShell } from './PayoutParts';
import {
  employeeLabel,
  formatMoney,
  KIND_LABELS,
  moneyInputValue,
  monthName,
  parseMoneyInput,
} from './payoutUtils';

export type PayoutModalItem = {
  employee: PayrollPayoutEmployee;
  due: number;
  paid: number;
  rest: number;
};

export const PAYOUT_ARTICLES_SETTINGS_PATH = '/payroll?view=settings';

function defaultArticleId(articles: PayrollPayoutArticle[], kind: PayrollPayoutKind) {
  const prefix = kind === 'ADVANCE' ? 'аванс' : 'расч';

  return (
    articles.find((article) => article.name.toLowerCase().startsWith(prefix))?.id ??
    articles[0]?.id ??
    ''
  );
}

// Окно выплаты одному сотруднику или сразу нескольким: на каждого создаётся своя выплата.
export default function PayoutModal({
  month,
  kind,
  items,
  articles,
  defaultPaidAt,
  isSaving,
  onClose,
  onSubmit,
}: {
  month: string;
  kind: PayrollPayoutKind;
  items: PayoutModalItem[];
  articles: PayrollPayoutArticle[];
  defaultPaidAt: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (_payload: PayrollPayoutCreatePayload) => void;
}) {
  const activeArticles = useMemo(
    () => articles.filter((article) => !article.is_archived),
    [articles],
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [item.employee.id, moneyInputValue(item.rest)]),
    ),
  );
  const [articleId, setArticleId] = useState(() =>
    defaultArticleId(activeArticles, kind),
  );
  const [paidAt, setPaidAt] = useState(defaultPaidAt);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const single = items.length === 1 ? items[0] : null;
  const parsed = items.map((item) => parseMoneyInput(amounts[item.employee.id] ?? ''));
  const total = parsed.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  const singleAmount = single ? parsed[0] : null;
  const title = `Выплата: ${KIND_LABELS[kind].toLowerCase()} за ${monthName(month)} ${month.slice(0, 4)}`;

  let hint = '';
  let isOverpayment = false;
  if (single && singleAmount) {
    if (singleAmount < single.rest) {
      hint = `После выплаты останется ${formatMoney(single.rest - singleAmount)}.`;
    } else if (singleAmount === single.rest) {
      hint = 'Выплата закрывает сумму полностью.';
    } else {
      hint = `Переплата ${formatMoney(singleAmount - single.rest)} будет зачтена в следующих выплатах.`;
      isOverpayment = true;
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (parsed.some((amount) => amount === null)) {
      setError('Проверьте суммы: нужны числа вида 15000,00.');
      return;
    }

    const payoutItems = items
      .map((item, index) => ({
        employee_id: item.employee.id,
        amount: parsed[index] ?? 0,
      }))
      .filter((item) => item.amount > 0);

    if (!payoutItems.length) {
      setError(
        single ? 'Укажите сумму больше нуля.' : 'Все суммы нулевые, проводить нечего.',
      );
      return;
    }
    if (!articleId) {
      setError('Выберите основание выплаты.');
      return;
    }
    if (!paidAt) {
      setError('Укажите дату выплаты.');
      return;
    }

    setError('');
    onSubmit({
      month,
      kind,
      article_id: articleId,
      paid_at: paidAt,
      comment: comment.trim() || null,
      items: payoutItems,
    });
  };

  return (
    <PayoutModalShell
      title={title}
      subtitle={
        single
          ? employeeLabel(single.employee)
          : `Сотрудников: ${items.length}. На каждого создаётся отдельная выплата.`
      }
      isSaving={isSaving}
      wide={!single}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className='grid gap-3' noValidate>
        {single ? (
          <>
            <dl className='grid grid-cols-3 gap-2 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] px-3 py-2.5 text-sm'>
              {[
                ['К выплате', single.due],
                ['Уже выплачено', single.paid],
                ['Остаток', single.rest],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className='text-xs text-[#7e8fb4]'>{label}</dt>
                  <dd className='font-semibold text-[#10275a] tabular-nums'>
                    {formatMoney(value as number)}
                  </dd>
                </div>
              ))}
            </dl>
            <Field label='Сумма, руб.'>
              <Input
                autoFocus
                inputMode='decimal'
                autoComplete='off'
                value={amounts[single.employee.id] ?? ''}
                onChange={(event) => {
                  setError('');
                  setAmounts({ [single.employee.id]: event.target.value });
                }}
              />
            </Field>
            <p
              className={`min-h-5 text-sm ${isOverpayment ? 'text-amber-700' : 'text-[#7e8fb4]'}`}
            >
              {hint}
            </p>
          </>
        ) : (
          <>
            <div className='grid max-h-64 gap-2 overflow-y-auto pr-1'>
              {items.map((item) => (
                <label
                  key={item.employee.id}
                  className='grid grid-cols-[minmax(0,1fr)_150px] items-center gap-3 text-sm'
                >
                  <span className='min-w-0'>
                    <span className='block truncate font-semibold text-[#10275a]'>
                      {employeeLabel(item.employee)}
                    </span>
                    <span className='block text-xs text-[#7e8fb4]'>
                      остаток {formatMoney(item.rest)}
                    </span>
                  </span>
                  <Input
                    inputMode='decimal'
                    autoComplete='off'
                    className='text-right'
                    aria-label={`Сумма: ${employeeLabel(item.employee)}`}
                    value={amounts[item.employee.id] ?? ''}
                    onChange={(event) => {
                      setError('');
                      setAmounts((current) => ({
                        ...current,
                        [item.employee.id]: event.target.value,
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
            <p className='text-sm font-semibold text-[#10275a] tabular-nums'>
              Итого: {formatMoney(total)}
            </p>
          </>
        )}

        <Field label='Основание'>
          <Select
            value={articleId}
            onChange={(event) => setArticleId(event.target.value)}
          >
            {!activeArticles.length ? <option value=''>Статей нет</option> : null}
            {activeArticles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.name}
              </option>
            ))}
          </Select>
        </Field>
        {!activeArticles.length ? (
          <p className='text-sm text-amber-700'>
            Добавьте статьи в разделе{' '}
            <Link className='font-semibold underline' to={PAYOUT_ARTICLES_SETTINGS_PATH}>
              Оплата труда → Настройки → Статьи
            </Link>
            .
          </p>
        ) : null}

        <Field label='Дата выплаты'>
          <Input
            type='date'
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
          />
        </Field>

        <Field label='Комментарий'>
          <Input
            maxLength={500}
            autoComplete='off'
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </Field>

        {error ? (
          <p className='rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700'>{error}</p>
        ) : null}

        <div className='mt-1 flex flex-wrap justify-end gap-2'>
          <Button variant='secondary' disabled={isSaving} onClick={onClose}>
            Отмена
          </Button>
          <Button type='submit' disabled={isSaving || !activeArticles.length}>
            {isSaving
              ? 'Сохранение...'
              : single
                ? 'Провести выплату'
                : 'Провести выплаты'}
          </Button>
        </div>
      </form>
    </PayoutModalShell>
  );
}
