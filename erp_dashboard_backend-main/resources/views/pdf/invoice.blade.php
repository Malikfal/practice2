<!-- Взял шаблон отсюда https://codepen.io/rozalski/pen/vYYLKWo и сам доверстал -->

@php
    $months = [
        1 => 'января', 2 => 'февраля', 3 => 'марта', 4 => 'апреля',
        5 => 'мая', 6 => 'июня', 7 => 'июля', 8 => 'августа',
        9 => 'сентября', 10 => 'октября', 11 => 'ноября', 12 => 'декабря'
    ];
    
    $createdAt = isset($invoice->created_at) ? \Carbon\Carbon::parse($invoice->created_at) : now();
    $dateString = $createdAt->format('d') . ' ' . $months[$createdAt->month] . ' ' . $createdAt->format('Y') . ' г.';
@endphp
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Счет на оплату от {{ $dateString }}</title>
    <style>
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 11px;
            color: #000;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        .border-all td, .border-all th {
            border: 1px solid #000;
            padding: 4px;
        }
        .border-none {
            border: none !important;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .align-top { vertical-align: top; }
        .align-bottom { vertical-align: bottom; }
        
        .requisites-table {
            border: 1px solid #000;
            margin-bottom: 20px;
        }
        .requisites-table td {
            border: 1px solid #000;
            padding: 4px;
            font-size: 10px;
        }
        .qr-placeholder {
            width: 100px;
            border-left: 1px solid #000;
            text-align: center;
            vertical-align: middle;
            font-size: 9px;
            color: #777;
        }

        .invoice-title {
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 10px;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
        }

        .info-table td {
            padding: 3px 0;
            vertical-align: top;
        }
        .info-label {
            width: 120px;
        }
        
        .items-table {
            margin-top: 15px;
            border: 2px solid #000;
        }
        .items-table th {
            border: 1px solid #000;
            padding: 5px;
            text-align: center;
            font-weight: bold;
        }
        .items-table td {
            border: 1px solid #000;
            padding: 5px;
        }
        .items-table-header {
            border-bottom: 2px solid #000;
        }
        
        .totals-table {
            margin-top: 10px;
        }
        .totals-table td {
            padding: 0 5px;
            line-height: 1;
        }
        
        .amount-words {
            margin-top: 15px;
            font-size: 12px;
        }
        
        .footer-note {
            margin-top: 15px;
            font-size: 9px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }
        .signatures {
            margin-top: 20px;
            width: 100%;
        }
        .signature-line {
            border-bottom: 1px solid #000;
            width: 200px;
            margin: 0 10px;
            height: 25px;
            vertical-align: bottom;
            position: relative;
        }
        .stamp-container {
            position: relative;
        }

        .img-signature {
            position: absolute;
            height: 40px;
            margin-top: -20px;
        }
        .img-stamp {
            position: absolute;
            height: 150px;
            left: 50px;
            top: 50px;
            opacity: 0.8;
            z-index: -1;
        }
    </style>
</head>
<body>

<table class="requisites-table">
    <tr>
        <td colspan="2" rowspan="2" class="align-top" style="width: 50%;">
            {{ $requisites['bank'] ?? '--' }}<br>
            <span style="font-size: 8pt;">Банк получателя</span>
        </td>
        <td style="width: 10%;">БИК</td>
        <td style="width: 40%;">{{ $requisites['bic'] ?? '--' }}</td>
    </tr>
    <tr>
        <td>Сч. №</td>
        <td>{{ $requisites['correspondent_account'] ?? '--' }}</td>
    </tr>
    <tr>
        <td style="width: 25%;">ИНН {{ $requisites['inn'] ?? '--' }}</td>
        <td style="width: 25%;">КПП {{ $requisites['kpp'] ?? '--' }}</td>
        <td rowspan="2" class="align-top">Сч. №</td>
        <td rowspan="2" class="align-top">{{ $requisites['checking_account'] ?? '--' }}</td>
    </tr>
    <tr>
        <td colspan="2" class="align-top">
            {{ 'ООО "АЛЬТ СТУДИЯ"' }}<br>
            <span style="font-size: 8pt;">Получатель</span>
        </td>
    </tr>
</table>

<div class="invoice-title">
    Счет на оплату от {{ $dateString }}
</div>

<table class="info-table">
    <tr>
        <td class="info-label">Поставщик<br>(Исполнитель):</td>
        <td class="font-bold">
            {{ 'ООО "АЛЬТ СТУДИЯ"' }}, ИНН {{ $requisites['inn'] ?? '--' }}, 
            @if(!empty($requisites['kpp'])) КПП {{ $requisites['kpp'] }}, @endif 
            {{ $requisites['address'] ?? '--' }}, 
            тел.: {{ $requisites['phone'] ?? '--' }}
        </td>
    </tr>
    <tr>
        <td class="info-label">Покупатель<br>(Заказчик):</td>
        <td class="font-bold">
            {{ $company_requisites['legal_name'] ?? '--' }}, 
            ИНН {{ $company_requisites['inn'] ?? '--' }}, 
            @if(!empty($company_requisites['kpp'])) КПП {{ $company_requisites['kpp'] }}, @endif
            {{ $company_requisites['address'] ?? '--' }},
            тел.: {{ $company_requisites['phone'] ?? '--' }}
        </td>
    </tr>
    <tr>
        <td class="info-label">Основание:</td>
        <td class="font-bold">
            ЛИЦЕНЗИОННЫЙ ДОГОВОР-ОФЕРТА
        </td>
    </tr>
</table>

<table class="items-table">
    <tr class="items-table-header">
        <th style="width: 5%;">№</th>
        <th style="width: 50%;">Товары (работы, услуги)</th>
        <th style="width: 10%;">Кол-во</th>
        <th style="width: 5%;">Ед.</th>
        <th style="width: 15%;">Цена</th>
        <th style="width: 15%;">Сумма</th>
    </tr>
    <tr>
        <td class="text-center">1</td>
        <td>Оплата лицензии за доступ к ФЛОУ (https://app.flow-erp.ru/), тариф "{{ $invoice->tariff->name ?? '--' }}" на {{ ($invoice->period_days ?? 30) > 30 ? round(($invoice->period_days ?? 30)/30).' мес.' : '1 месяц' }}</td>
        <td class="text-center">-</td>
        <td class="text-center">-</td>
        <td class="text-right">{{ number_format($invoice->amount ?? 0, 2, ',', ' ') }}</td>
        <td class="text-right">{{ number_format($invoice->amount ?? 0, 2, ',', ' ') }}</td>
    </tr>
</table>

@php
    $amount = $invoice->amount ?? 0;
    $nds = $amount * 5 / 105;
@endphp
<table class="totals-table">
    <tr>
        <td style="width: 40%;"></td>
        <td style="width: 15%;" class="text-right font-bold">Итого:</td>
        <td style="width: 15%;" class="text-right font-bold">{{ number_format($amount, 2, ',', ' ') }}</td>
    </tr>
    <tr>
        <td></td>
        <td class="text-right font-bold">В том числе НДС 5%:</td>
        <td class="text-right font-bold">{{ number_format($nds, 2, ',', ' ') }}</td>
    </tr>
    <tr>
        <td></td>
        <td class="text-right font-bold">Всего к оплате:</td>
        <td class="text-right font-bold">{{ number_format($amount, 2, ',', ' ') }}</td>
    </tr>
</table>

<div class="amount-words">
    Всего наименований 1, на сумму {{ number_format($amount, 2, ',', ' ') }} руб.<br>
    <span class="font-bold">{{ \App\Support\NumberToWords::rub($amount) }}</span>
</div>

<div class="footer-note">
    Оплата настоящего счёта означает акцепт оферты, размещенной по адресу: https://flow-erp.ru
</div>

<div class="stamp-container">

    <table class="signatures">
        <tr>
            <td style="width: 15%;" class="font-bold align-bottom">Руководитель</td>
            <td style="width: 35%;">
                <table style="width: 200px; margin: 0 10px;">
                    <tr>
                        <td class="signature-line">
                            <img src="{{ public_path('images/sign1.png') }}" class="img-signature" alt="Подпись">
                            <span style="float: right;">{{ $requisites['director'] ?? '--' }}</span>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 15%;" class="font-bold align-bottom">Бухгалтер</td>
            <td style="width: 35%;">
                <table style="width: 200px; margin: 0 10px;">
                    <tr>
                        <td class="signature-line">
                            <img src="{{ public_path('images/sign1.png') }}" class="img-signature" alt="Подпись">
                            <span style="float: right;">{{ $requisites['accountant'] ?? '--' }}</span>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <img src="{{ public_path('images/stamp.png') }}" class="img-stamp" alt="Печать">

</div>

</body>
</html>
