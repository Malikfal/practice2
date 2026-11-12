<!-- Взял шаблон отсюда https://modx.pro/help/21288 и сам доверстал -->

<!doctype html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>УПД от {{ isset($invoice->created_at) ? $invoice->created_at->format('d.m.Y') : date('d.m.Y') }}</title>
</head>

<body>
    <style>
    @page {
      size: 297mm 210mm; /* A4 Landscape */
      margin: 8mm; /* Минимальные отступы, чтобы всё влезло */
    }

    body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #FFF;
        font-family: 'DejaVu Sans', sans-serif;
    }

    * {
        -moz-box-sizing: border-box;
        -webkit-box-sizing: border-box;
        box-sizing: border-box;
    }

    body, td, th {
        font-weight: normal;
        color: #000;
        font-size: 6pt; /* Тот самый размер */
        line-height: 0.95; /* Уменьшаем межстрочный интервал */
    }

    body .upd, .upd td, .upd th {
        font-size: 6pt;
        vertical-align: top;
        line-height: 0.95;
    }

    /* Стили для мелких подписей в скобках (ф.и.о., подпись, должность) */
    .subtext, .header-note, .updorderlist .subtext {
        font-size: 5.5pt !important;
        text-align: center;
    }

    .bottom-fields, .bottom-fields td, .section-title {
        font-size: 7.5pt;
    }

    .bold {
        font-weight: bold;
    }

    table {
        border-collapse: collapse;
        table-layout: auto; /* Позволяем таблице ужиматься */
    }

    .updorderlist, .updorderlist td, .updorderlist th {
        border: 1px solid #000;
        border-collapse: collapse;
    }
    
    .updorderlist td, .updorderlist th {
        padding: 1px 2px; /* Уменьшаем внутренние отступы до минимума */
        word-wrap: break-word; /* Перенос длинных слов */
    }

    .table-header td {
        text-align: center !important;
        vertical-align: middle !important;
    }

    .updskeleton, .updskeleton > tbody > tr > td {
        border: 1px solid transparent;
    }
    </style>
    <div class="doc landscape upd">

<table class="updskeleton" width="100%" border="0" cellspacing="0" cellpadding="0">
  <tbody>
        <tr>
          <td width="59" style="padding: 5px; font-size: 5.5pt;">
                Универсальный передаточный документ

                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 5px 0px 5px 0px">
                    <tbody>
                        <tr>
                            <td style="vertical-align: middle !important;">Статус:</td>
                            <td style="width: 50%; border: 1px solid #000; text-align: center !important; padding: 1px">1</td>
                        </tr>
                    </tbody>
                </table>

                1 — счет-фактура и передаточный документ (акт)<br>

                2 — передаточный документ (акт)
            </td>
            <td style="border-left: 2px solid #000">
                <table width="100%" border="0" cellspacing="0" cellpadding="1">
                    <tbody>
                        <tr>
                            <td width="10"></td>
                            <td width="100">Счет-фактура №</td>
                            <td width="100" style="border-bottom: 1px solid #000; text-align: center !important">б/н</td>
                            <td width="20">от</td>
                            <td width="100" style="border-bottom: 1px solid #000; text-align: center !important">{{ isset($invoice->created_at) ? $invoice->created_at->format('d.m.Y') : date('d.m.Y') }}</td>
                            <td width="20">(1)</td>
                            <td rowspan="2" class="header-note">
                                Приложение № 1 к постановлению Правительства Российской Федерации от 26 декабря 2011 г. № 1137
                                (в редакции постановления Правительства Российской Федерации от 2 апреля 2021 г. № 534)
                            </td>
                        </tr>
                        <tr>
                            <td width="10"></td>
                            <td>Исправление №</td>
                            <td style="border-bottom: 1px solid #000"> </td>
                            <td>от</td>
                            <td style="border-bottom: 1px solid #000"> </td>
                            <td>(1а)</td>
                        </tr>
                    </tbody>
                </table>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tbody>
                        <tr>
                            <td width="50%">
                                <table width="100%" border="0" cellspacing="0" cellpadding="1">
                                    <tbody>
                                        <tr>
                                            <td width="5"></td>
                                            <td width="120"><b>Продавец:</b></td>
                                            <td style="border-bottom: 1px solid #000">{{ $requisites['name'] ?? 'ООО "АЛЬТ СТУДИЯ"' }}</td>
                                            <td width="20">(2)</td>
                                        </tr>
                                        <tr>
                                            <td width="5"></td>
                                            <td>Адрес:</td>
                                            <td style="border-bottom: 1px solid #000">{{ $requisites['address'] ?? '--' }}</td>
                                            <td>(2а)</td>
                                        </tr>
                                        <tr>
                                            <td width="5"></td>
                                            <td>ИНН/КПП продавца:</td>
                                            <td style="border-bottom: 1px solid #000">{{ $requisites['inn'] ?? '--' }}/{{ $requisites['kpp'] ?? '--' }}</td>
                                            <td>(2б)</td>
                                        </tr>
                                        <tr>
                                            <td width="5"></td>
                                            <td>Грузоотправитель и его адрес:</td>
                                            <td style="border-bottom: 1px solid #000">--</td>
                                            <td>(3)</td>
                                        </tr>
                                        <tr>
                                            <td width="5"></td>
                                            <td>Грузополучатель и его адрес:</td>
                                            <td style="border-bottom: 1px solid #000">--</td>
                                            <td>(4)</td>
                                        </tr>
                                        <tr>
                                            <td width="5"></td>
                                            <td>К платежно-расчетному документу №</td>
                                            <td style="border-bottom: 1px solid #000">
                                                @if($invoice->isPaid() && $invoice->paid_at)
                                                    б/н от {{ \Carbon\Carbon::parse($invoice->paid_at)->format('d.m.Y') }}
                                                @else
                                                    --
                                                @endif
                                            </td>
                                            <td>(5)</td>
                                        </tr>
                                        <tr>
                                            <td width="5"></td>
                                            <td>Документ об отгрузке</td>
                                            <td style="border-bottom: 1px solid #000">Универсальный передаточный документ, б/н от {{ isset($invoice->created_at) ? $invoice->created_at->format('d.m.Y') : date('d.m.Y') }}</td>
                                            <td>(5a)</td>
                                        </tr>
                                    </tbody>
                                </table>

                            </td>
                            <td>
                                <table width="100%" border="0" cellspacing="0" cellpadding="1">
                                    <tbody>
                                        <tr>
                                            <td width="130"><b>Покупатель:</b></td>
                                            <td style="border-bottom: 1px solid #000">{{ $company_requisites['legal_name'] ?? '--' }}</td>
                                            <td width="20">(6)</td>
                                        </tr>
                                        <tr>
                                            <td>Адрес:</td>
                                            <td style="border-bottom: 1px solid #000">{{ $company_requisites['address'] ?? '--' }}</td>
                                            <td>(6а)</td>
                                        </tr>
                                        <tr>
                                            <td>ИНН/КПП покупателя:</td>
                                            <td style="border-bottom: 1px solid #000">{{ $company_requisites['inn'] ?? '--' }}/{{ $company_requisites['kpp'] ?? '--' }}</td>
                                            <td>(6б)</td>
                                        </tr>
                                        <tr>
                                            <td>Валюта: наименование, код</td>
                                            <td style="border-bottom: 1px solid #000">Российский рубль, 643</td>
                                            <td>(7)</td>
                                        </tr>
                                        <tr>
                                            <td>Идентификатор государственного контракта, договора (соглашения) (при наличии):</td>
                                            <td style="border-bottom: 1px solid #000">--</td>
                                            <td>(8)</td>
                                        </tr>
                                    </tbody>
                                </table>

                            </td>
                        </tr>
                    </tbody>
                </table>

            </td>
        </tr>
        <tr>
            <td width="65"></td>
            <td style="border-left: 2px solid #000; height: 10px;"></td>
        </tr>
    </tbody>
</table>

<table class="updorderlist" width="100%" border="0" cellspacing="0" cellpadding="1">
  <tbody>
    <tr class="table-header">
      <td width="63.5" rowspan="2">Код товара / работ, услуг</td>
      <td rowspan="2" style="border-left:2px solid #000">№ п/п</td>
      <td rowspan="2">Наименование товара (описание выполненных работ, оказанных услуг), имущественного права</td>
      <td rowspan="2">Код вида това-<br>ра</td>
      <td colspan="2">Единица измерения</td>
      <td rowspan="2">Количест-<br>во (объём)</td>
      <td rowspan="2">Цена (тариф) за единицу измерения</td>
      <td rowspan="2">Стоимость товаров (работ, услуг), имущест-<br>венных прав без налога — всего</td>
      <td rowspan="2">В том числе сумма акциза</td>
      <td rowspan="2">Нало-<br>говая ставка</td>
      <td rowspan="2">Сумма налога, предъяв-<br>ляемая покупателю</td>
      <td rowspan="2">Стоимость товаров (работ, услуг), имущест-<br>венных прав с налогом — всего</td>
      <td colspan="2">Страна происхождения товара</td>
      <td rowspan="2">Регистраци-<br>онный номер декларации на товары или регист-<br>рационный номер пар-<br>тии товара, подлежаще-<br>го просле-<br>живаемости</td>
    </tr>
    <tr class="table-header">
      <td width="40">Код</td>
      <td width="30">Условно-
е обоз-
начение (нацио-
нальное)</td>
      <td width="30">Циф-
ровой код</td>
      <td width="30">Краткое наиме-
нование</td>
      </tr>
    <tr>
      <td style="border-right:2px solid #000; text-align: center; font-size: 5.5pt">A</td>
      <td style="text-align: center; font-size: 5.5pt">1</td>
      <td style="text-align: center; font-size: 5.5pt">1а</td>
      <td style="text-align: center; font-size: 5.5pt">1б</td>
      <td style="text-align: center; font-size: 5.5pt">2</td>
      <td style="text-align: center; font-size: 5.5pt">2а</td>
      <td style="text-align: center; font-size: 5.5pt">3</td>
      <td style="text-align: center; font-size: 5.5pt">4</td>
      <td style="text-align: center; font-size: 5.5pt">5</td>
      <td style="text-align: center; font-size: 5.5pt">6</td>
      <td style="text-align: center; font-size: 5.5pt">7</td>
      <td style="text-align: center; font-size: 5.5pt">8</td>
      <td style="text-align: center; font-size: 5.5pt">9</td>
      <td style="text-align: center; font-size: 5.5pt">10</td>
      <td style="text-align: center; font-size: 5.5pt">10а</td>
      <td style="text-align: center; font-size: 5.5pt">11</td>
    </tr>
    <tr>
      <td style="border-right:2px solid #000">БП-00000074</td>
      <td>1</td>
      <td>Лицензия на доступ к ФЛОУ (https://app.flow-erp.ru/), тариф "{{ $invoice->tariff->name ?? 'Индивидуальный' }}" на {{ round($invoice->period_months ?? ($invoice->period_days / 30) ?? 1, 1) }} мес.</td>
      <td> </td>
      <td>--</td>
      <td>--</td>
      <td>--</td>
      <td>--</td>
      <td>{{ number_format(($invoice->amount - ($invoice->amount * 5 / 105)), 2, ',', '') }}</td>
      <td>без акциза</td>
      <td>5%</td>
      <td>{{ number_format(($invoice->amount * 5 / 105), 2, ',', '') }}</td>
      <td>{{ number_format($invoice->amount, 2, ',', '') }}</td>
      <td>--</td>
      <td>--</td>
      <td>--</td>
    </tr>
    <tr>
      <td style="border-right:2px solid #000"> </td>
      <td colspan="7">Всего к оплате (9)</td>
      <td>{{ number_format(($invoice->amount - ($invoice->amount * 5 / 105)), 2, ',', '') }}</td>
      <td colspan="2" style="text-align: center !important">X</td>
      <td>{{ number_format(($invoice->amount * 5 / 105), 2, ',', '') }}</td>
      <td>{{ number_format($invoice->amount, 2, ',', '') }}</td>
      <td colspan="3"> </td>
      </tr>
  </tbody>
</table>
<table class="updskeleton bottom-fields" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tbody>
        <tr>
            <td width="65"></td>
            <td style="border-left: 2px solid #000; height: 10px;"></td>
        </tr>
        <tr>
            <td width="65" style="padding: 1px">
                Документ составлен на 1 листе
            </td>
            <td style="border-left: 2px solid #000; border-bottom: 2px solid #000; padding-bottom: 5px; padding-left: 10px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tbody>
                        <tr>
                            <td width="49%">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                  <tbody>
                                    <tr>
                                      <td style="padding: 1px">Руководитель организации или иное уполномоченное лицо</td>
                                      <td style="border-bottom: 1px solid #000; padding: 1px" width="70"> </td>
                                      <td width="5"> </td>
                                      <td style="vertical-align: bottom !important; border-bottom: 1px solid #000; padding: 1px" width="110">{{ $requisites['director'] ?? '' }}</td>
                                    </tr>
                                    <tr>
                                      <td> </td>
                                      <td style="text-align: center; font-size: 5.5pt">(подпись)</td>
                                      <td> </td>
                                      <td style="text-align: center; font-size: 5.5pt">(ф.и.о.)</td>
                                    </tr>
                                  </tbody>
                                </table>
                            </td>
                            <td width="2%"> </td>
                            <td width="49%">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                  <tbody>
                                    <tr>
                                      <td style="padding: 1px">Главный бухгалтер или иное уполномоченное лицо</td>
                                      <td style="border-bottom: 1px solid #000; padding: 1px" width="70"> </td>
                                      <td width="5"> </td>
                                      <td style="vertical-align: bottom !important; border-bottom: 1px solid #000; padding: 1px" width="140">{{ $requisites['accountant'] ?? '' }}</td>
                                    </tr>
                                    <tr>
                                      <td> </td>
                                      <td style="text-align: center; font-size: 5.5pt">(подпись)</td>
                                      <td> </td>
                                      <td style="text-align: center; font-size: 5.5pt">(ф.и.о.)</td>
                                    </tr>
                                  </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="padding: 1px">Индивидуальный предприниматель или иное уполномоченное лицо</td>
                      <td style="border-bottom: 1px solid #000; padding: 1px" width="70"> </td>
                      <td width="5"> </td>
                      <td style="vertical-align: bottom !important; border-bottom: 1px solid #000; padding: 1px" width="110"> </td>
                      <td width="5%"> </td>
                      <td style="vertical-align: bottom !important; border-bottom: 1px solid #000; padding: 1px" width="46%"> </td>
                    </tr>
                    <tr>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(подпись)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(ф.и.о.)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(основной государственный регистрационный номер индивидуального предпринимателя и дата присвоения такого номера)</td>
                    </tr>
                  </tbody>
                </table>
            </td>
        </tr>
    </tbody>
</table>
<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tbody>
    <tr><td colspan="3" style="height: 10px;"></td></tr>
    <tr>
      <td width="280" style="padding: 1px; font-size: 7.5pt;">Основание передачи (сдачи) / получения (приемки)</td>
      <td style="border-bottom: 1px solid #000; padding: 1px">ЛИЦЕНЗИОННЫЙ ДОГОВОР-ОФЕРТА</td>
      <td width="10" style="padding: 1px">[8]</td>
    </tr>
    <tr>
      <td> </td>
      <td style="text-align: center; font-size: 5.5pt">(договор, доверенность и др.)</td>
      <td> </td>
    </tr>
  </tbody>
</table>
<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td width="190" style="padding: 1px; padding-top:0px; font-size: 7.5pt;">Данные о транспортировке и грузе</td>
      <td style="border-bottom: 1px solid #000; padding: 1px; padding-top:0px;"> </td>
      <td width="10" style="padding: 5px; padding-top:0px;">[9]</td>
    </tr>
    <tr>
      <td> </td>
      <td style="text-align: center; font-size: 5.5pt; padding-bottom: 5px">(транспортная накладная, поручение экспедитору, экспедиторская/складская расписка и др., масса нетто/брутто груза, если не приведены ссылки на транспортные документы, содержащие эти сведения)</td>
      <td> </td>
    </tr>
  </tbody>
</table>
<table class="bottom-fields" width="100%" border="0" cellspacing="0" cellpadding="0" style="page-break-inside:avoid">
    <tbody>
        <tr>
            <td width="50%" style="padding-right: 5px; border-right: 2px solid #000">
                <div style="padding-left:5px;">Товар (груз) передал / услуги, результаты работ, права сдал</div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td width="100" style="border-bottom: 1px solid #000; padding: 5px"></td>
                      <td width="10"> </td>
                      <td width="100" style="border-bottom: 1px solid #000"> </td>
                      <td width="10"> </td>
                      <td width="100" style="border-bottom: 1px solid #000; padding: 5px">{{ $requisites['director'] ?? '' }}</td>
                      <td width="10" style="padding: 5px">[10]</td>
                    </tr>
                    <tr>
                      <td style="text-align: center; font-size: 5.5pt">(должность)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(подпись)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(ф.и.о.)</td>
                      <td> </td>
                    </tr>
                  </tbody>
                </table>
                <table width="100%" border="0" cellspacing="0" cellpadding="5" style="margin-top: 4px;">
                  <tbody>
                    <tr>
                      <td width="210">Дата отгрузки, передачи (сдачи)</td>
                      <td style="border-bottom: 1px solid #000;">{{ isset($invoice->created_at) ? $invoice->created_at->format('d.m.Y') : date('d.m.Y') }}</td>
                      <td width="10">[11]</td>
                    </tr>
                  </tbody>
                </table>

                <div style="padding-left:5px; margin-top: 4px;">Иные сведения об отгрузке, передаче</div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="border-bottom: 1px solid #000"> </td>
                      <td width="10" style="padding: 5px">[12]</td>
                    </tr>
                    <tr>
                      <td style="text-align: center; font-size: 5.5pt">(ссылки на неотъемлемые приложения, сопутствующие документы, иные документы и т.п.)</td>
                      <td style="height: 3px"> </td>
                    </tr>
                  </tbody>
                </table>

                <div style="padding-left:5px; margin-top: 4px;">Ответственный за правильность оформления факта хозяйственной жизни</div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td width="100" style="border-bottom: 1px solid #000; padding: 5px">{{ 'Генеральный Директор' }}</td>
                      <td width="10"> </td>
                      <td width="100" style="border-bottom: 1px solid #000"> </td>
                      <td width="10"> </td>
                      <td width="100" style="border-bottom: 1px solid #000; padding: 5px">{{ $requisites['director'] ?? '' }}</td>
                      <td width="10" style="padding: 5px">[13]</td>
                    </tr>
                    <tr>
                      <td style="text-align: center; font-size: 5.5pt">(должность)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(подпись)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(ф.и.о.)</td>
                      <td> </td>
                    </tr>
                  </tbody>
                </table>

                <div style="padding-left:5px; margin-top: 4px;">Наименование экономического субъекта — составителя документа (в т. ч. комиссионера / агента)</div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="border-bottom: 1px solid #000; padding: 5px">{{ $requisites['name'] ?? 'ООО "АЛЬТ СТУДИЯ"' }}, ИНН/КПП {{ $requisites['inn'] ?? '' }}/{{ $requisites['kpp'] ?? '' }}</td>
                      <td width="10" style="padding: 5px">[14]</td>
                    </tr>
                    <tr>
                      <td style="text-align: center; font-size: 5.5pt">(может не заполняться при проставлении печати в М.П., может быть указан ИНН/КПП)</td>
                      <td> </td>
                    </tr>
                  </tbody>
                </table>

                <div style="padding-left:50px;">М.П.</div>
            </td>
            <td style="padding-left: 5px">
                <div style="padding-left:5px;">Товар (груз) получил / услуги, результаты работ, права принял</div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td width="200" style="border-bottom: 1px solid #000;"> </td>
                      <td width="10"> </td>
                      <td style="border-bottom: 1px solid #000" width="100"> </td>
                      <td width="10"> </td>
                      <td style="border-bottom: 1px solid #000;"> </td>
                      <td width="10" style="padding: 5px">[15]</td>
                    </tr>
                    <tr>
                      <td style="text-align: center; font-size: 5.5pt">(должность)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(подпись)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(ф.и.о.)</td>
                      <td> </td>
                    </tr>
                  </tbody>
                </table>
                <table width="100%" border="0" cellspacing="0" cellpadding="5" style="margin-top: 4px;">
                  <tbody>
                    <tr>
                      <td width="210">Дата получения (приемки)</td>
                      <td style="border-bottom: 1px solid #000;"> </td>
                      <td width="10">[16]</td>
                    </tr>
                  </tbody>
                </table>

                <div style="padding-left:5px; margin-top: 4px;">Иные сведения о получении, приемке</div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="border-bottom: 1px solid #000"> </td>
                      <td width="10" style="padding: 5px">[17]</td>
                    </tr>
                    <tr>
                      <td style="text-align: center; font-size: 5.5pt">(информация о наличии/отсутствии претензии; ссылки на неотъемлемые приложения и другие документы и т. п.)</td>
                      <td> </td>
                    </tr>
                  </tbody>
                </table>

                <div style="padding-left:5px; margin-top: 4px;">Ответственный за правильность оформления факта хозяйственной жизни</div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td width="200" style="border-bottom: 1px solid #000"> </td>
                      <td width="10"> </td>
                      <td style="border-bottom: 1px solid #000" width="100"> </td>
                      <td width="10"> </td>
                      <td style="border-bottom: 1px solid #000"> </td>
                      <td width="10" style="padding: 5px">[18]</td>
                    </tr>
                    <tr>
                      <td style="text-align: center; font-size: 5.5pt">(должность)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(подпись)</td>
                      <td> </td>
                      <td style="text-align: center; font-size: 5.5pt">(ф.и.о.)</td>
                      <td> </td>
                    </tr>
                  </tbody>
                </table>

                <div style="padding-left:5px; margin-top: 4px;">Наименование экономического субъекта — составителя документа</div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tbody>
                    <tr>
                      <td style="border-bottom: 1px solid #000; padding: 5px">{{ $company_requisites['legal_name'] ?? '--' }}, ИНН/КПП {{ $company_requisites['inn'] ?? '--' }}/{{ $company_requisites['kpp'] ?? '--' }}</td>
                      <td width="10" style="padding: 5px">[19]</td>
                    </tr>
                    <tr>
                      <td style="text-align: center; font-size: 5.5pt">(может не заполняться при проставлении печати в М.П., может быть указан ИНН/КПП)</td>
                      <td> </td>
                    </tr>
                  </tbody>
                </table>

                <div style="padding-left:50px;">М.П.</div>
            </td>
        </tr>
    </tbody>
</table>


    </div>
</body>
</html>
