@extends('admin.layout')

@section('title', 'Реквизиты компании')

@section('content')

<h2>Настройки: Реквизиты платформы</h2>

<div style="margin-bottom: 20px; padding: 10px; background: #f0f0f0;">
    Данные реквизиты будут использоваться для выставления счетов клиентам для продления подписки.
</div>

<form method="POST" action="{{ route('admin.settings.requisites.update') }}" style="max-width: 500px;">
    @csrf

    <div style="margin-bottom: 15px;">
        <label><strong>Наименование банка:</strong></label><br>
        <input type="text" name="bank" value="{{ old('bank', $requisites['bank'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 15px;">
        <label><strong>Расчетный счет:</strong></label><br>
        <input type="text" name="checking_account" value="{{ old('checking_account', $requisites['checking_account'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 15px;">
        <label><strong>Корреспондентский счет:</strong></label><br>
        <input type="text" name="correspondent_account" value="{{ old('correspondent_account', $requisites['correspondent_account'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 15px;">
        <label><strong>БИК:</strong></label><br>
        <input type="text" name="bic" value="{{ old('bic', $requisites['bic'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 15px;">
        <label><strong>Адрес:</strong></label><br>
        <input type="text" name="address" value="{{ old('address', $requisites['address'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 15px;">
        <label><strong>ИНН:</strong></label><br>
        <input type="text" name="inn" value="{{ old('inn', $requisites['inn'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 15px;">
        <label><strong>КПП:</strong></label><br>
        <input type="text" name="kpp" value="{{ old('kpp', $requisites['kpp'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 15px;">
        <label><strong>Руководитель:</strong></label><br>
        <input type="text" name="director" value="{{ old('director', $requisites['director'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 15px;">
        <label><strong>Бухгалтер:</strong></label><br>
        <input type="text" name="accountant" value="{{ old('accountant', $requisites['accountant'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <div style="margin-bottom: 20px;">
        <label><strong>Номер телефона:</strong></label><br>
        <input type="text" name="phone" value="{{ old('phone', $requisites['phone'] ?? '') }}" style="width: 100%; padding: 8px;">
    </div>

    <button type="submit" style="padding: 10px 20px; font-weight: bold; border: none; cursor: pointer;">Сохранить реквизиты</button>
</form>

@endsection
