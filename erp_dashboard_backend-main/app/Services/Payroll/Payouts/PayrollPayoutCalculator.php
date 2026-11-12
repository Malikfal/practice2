<?php

namespace App\Services\Payroll\Payouts;

use App\Services\Payroll\Payouts\Data\PayrollPayoutCell;
use App\Services\Payroll\Payouts\Data\PayrollPayoutMonth;

/**
 * Считает ведомость сотрудника по месяцам от начала учета.
 *
 * Перенос между месяцами идет по суммам к выплате: расчет = перенос + начислено - аванс,
 * а все, что не вошло в аванс и расчет (ручное округление, перерасчет после фиксации,
 * переплата), переходит на следующий месяц. Задолженность считается по фактическим
 * выплатам: остаток на конец = остаток на начало + начислено - выплачено.
 */
final class PayrollPayoutCalculator
{
    /**
     * @param  list<string>  $months  Месяцы ГГГГ-ММ по возрастанию, начиная с месяца начала учета
     * @param  array<string, array{accrued:int, first_half:int}>  $accruals
     * @param  array<string, array{advance:?int, advance_manual:bool, settlement:?int, settlement_manual:bool}>  $plans
     * @param  array<string, array{advance:int, settlement:int}>  $paid
     * @return array<string, PayrollPayoutMonth>
     */
    public function chain(int $opening, array $months, array $accruals, array $plans, array $paid): array
    {
        $carry = $opening;
        $debt = $opening;
        $result = [];

        foreach ($months as $month) {
            $accrued = $accruals[$month]['accrued'] ?? 0;
            $firstHalf = $accruals[$month]['first_half'] ?? 0;
            $plan = $plans[$month] ?? null;
            $paidAdvance = $paid[$month]['advance'] ?? 0;
            $paidSettlement = $paid[$month]['settlement'] ?? 0;

            $advanceDue = $plan['advance'] ?? $firstHalf;
            // Переплаченный аванс уменьшает расчет этого же месяца, а не уходит в перенос.
            $advanceClosed = max($advanceDue, $paidAdvance);
            $settlementAuto = max(0, $carry + $accrued - $advanceClosed);
            $settlementDue = $plan['settlement'] ?? $settlementAuto;

            $totalDue = $advanceClosed + $settlementDue;
            $totalPaid = $paidAdvance + $paidSettlement;
            $carryOut = $carry + $accrued - max($totalDue, $totalPaid);
            $debtOut = $debt + $accrued - $totalPaid;

            $result[$month] = new PayrollPayoutMonth(
                month: $month,
                carryIn: $carry,
                accrued: $accrued,
                firstHalf: $firstHalf,
                advance: new PayrollPayoutCell(
                    due: $advanceDue,
                    auto: $firstHalf,
                    paid: $paidAdvance,
                    isFixed: isset($plan['advance']),
                    isManual: isset($plan['advance']) && $plan['advance_manual'],
                ),
                settlement: new PayrollPayoutCell(
                    due: $settlementDue,
                    auto: $settlementAuto,
                    paid: $paidSettlement,
                    isFixed: isset($plan['settlement']),
                    isManual: isset($plan['settlement']) && $plan['settlement_manual'],
                ),
                totalDue: $totalDue,
                carryOut: $carryOut,
                debtIn: $debt,
                debtOut: $debtOut,
            );

            $carry = $carryOut;
            $debt = $debtOut;
        }

        return $result;
    }
}
