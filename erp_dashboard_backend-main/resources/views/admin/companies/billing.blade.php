@extends('admin.layout')

@section('title', 'Биллинг компании')

@section('content')
<!-- <p><a href="{{ route('admin.companies.index') }}">Назад к списку</a></p> -->

<h2>Карточка компании: {{ $company->name }}</h2>

<div style="margin-bottom: 20px; padding: 10px; background: #f0f0f0;">
    <a href="{{ route('admin.companies.show', $company) }}" style="margin-right: 15px;">Общая информация</a>
    <a href="{{ route('admin.companies.billing', $company) }}" style="font-weight: bold;">Биллинг и тарифы</a>
</div>

<!-- Вывод системных сообщений и ошибок -->
@if (session('status'))
    <div style="color: green; margin-bottom: 15px;"><strong>{{ session('status') }}</strong></div>
@endif
@if ($errors->any())
    <div style="color: red; margin-bottom: 15px;">
        <ul>
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    </div>
@endif

<p><strong>Текущий тариф:</strong> {{ $company->tariff?->name ?? 'Не назначен' }}</p>
<div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
    <div>
        <strong>Подписка активна до:</strong> 
        @if(!$company->subscription)
            Нет активной подписки
        @elseif(is_null($company->subscription->ends_at))
            Бессрочная
        @else
            {{ $company->subscription->ends_at->format('d.m.Y H:i') }}
        @endif
    </div>

    @if (($company->status?->value ?? '') !== 'BLOCKED')
    <form method="POST" action="{{ route('admin.companies.subscriptions.update_end_date', $company) }}" style="display: flex; gap: 10px; align-items: center;">
        @csrf
        <input 
            type="date" 
            name="ends_at" 
            required 
            min="{{ date('Y-m-d') }}"
            value="{{ $company->subscription?->ends_at?->format('Y-m-d') }}"
            style="padding: 5px; border: 1px solid #ccc; border-radius: 4px;"
        >
        <button type="submit" style="padding: 5px 15px; cursor: pointer;">Изменить дату</button>
    </form>
    @endif
</div>

@if (($company->status?->value ?? '') !== 'BLOCKED')
<div style="display: flex; gap: 40px; margin-top: 20px; margin-bottom: 40px;">
    
    <div style="border: 1px solid #ccc; padding: 15px; flex: 1;">
        <h3>Управление тарифом в ручную</h3>
        <form method="POST" action="{{ route('admin.companies.update_tariff', $company)}}">
            @csrf
            @method('PATCH')

            <label><strong>Тарифный план:</strong></label><br>
            <select id="tariff_select" name="tariff_id" required style="margin-top: 10px; margin-bottom: 10px; width: 100%;">
                @foreach ($tariffs as $tariff)
                    <option value="{{ $tariff->id }}" {{ $company->tariff_id === $tariff->id ? 'selected' : '' }}>
                        {{ $tariff->name }} ({{ $tariff->max_employees !== null ? "лимит: {$tariff->max_employees}" : 'безлимит' }})
                    </option>
                @endforeach
            </select><br>

            <div id="tariff_details" style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border: 1px solid #eee; font-size: 0.9em; display: none;">
                <!-- Здесь будут отображаться детали выбранного тарифа -->
            </div>

            <label><strong>Период оплаты:</strong></label><br>
            <select name="period_months" style="margin-top: 10px; margin-bottom: 15px; width: 100%;">
                <option value="">Без периода</option>
                <option value="1">1 месяц</option>
                <option value="3">3 месяца</option>
                <option value="6">6 месяцев</option>
                <option value="12">12 месяцев</option>
            </select><br>

            <p style="background-color: #f9f9f9; color: #555; font-size: 0.9em; border-top: none;">При выборе периода оплаты "Без периода" произодет перерасчет исходя из цены текущего тарифа и остатка по дням (без выставления счёта)</p>
            <p style="background-color: #f9f9f9; color: #555; font-size: 0.9em; border-top: none;">В остальных случаях будет сформирован счёт (даже в случае, если при перерасчете цена смены тарифа = 0)</p>

            <button type="submit">Подтвердить измения</button>
        </form>
    </div>

    <div style="border: 1px solid #ccc; padding: 15px; flex: 1;">
        <h3>Создать индивидуальный тариф</h3>
        <form method="POST" action="{{ route('admin.companies.individual_tariff.store', $company) }}">
            @csrf
            <div style="margin-top: 10px;">
                <label><strong>Название:</strong></label><br>
                <input type="text" name="name" required placeholder="Например, ООО 'Название компании'" style="width: 100%; margin-top: 5px;">
            </div>
            
            <div style="margin-top: 10px;">
                <label><strong>Стоимость за месяц (₽):</strong></label><br>
                <input type="number" name="price" required min="0" placeholder="15000" style="width: 100%; margin-top: 5px;">
            </div>

            <div style="margin-top: 10px;">
                <label><strong>Лимит сотрудников (пусто = безлимит):</strong></label><br>
                <input type="number" name="max_employees" min="1" placeholder="50" style="width: 100%; margin-top: 5px;">
            </div>

            <div style="margin-top: 10px;">
                <label><strong>Период оплаты (мес.):</strong></label><br>
                <select name="period_months" required style="width: 100%; margin-top: 5px; padding: 5px;">
                    <option value="1">1 месяц</option>
                    <option value="3">3 месяца</option>
                    <option value="6">6 месяцев</option>
                    <option value="12">12 месяцев</option>
                </select>
            </div>

            <button type="submit" style="margin-top: 15px;">Создать и сформировать счет</button>
        </form>
    </div>

</div>
@endif

<h3>История счетов</h3>
<table border="1" cellpadding="6" cellspacing="0" width="100%">
    <thead>
        <tr>
            <th>Номер</th>
            <th>Тариф</th>
            <th>Сумма</th>
            <th>Период</th>
            <th>Создан</th>
            <th>Статус</th>
            <th>Действия</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($invoices as $invoice)
        <tr>
            <td>{{ $invoice->number }}</td>
            <td>{{ $invoice->tariff?->name ?? '-' }}</td>
            <td>{{ number_format($invoice->amount, 0, '.', ' ') }} ₽</td>
            <td>{{ $invoice->period_days }} дн.</td>
            <td>{{ $invoice->created_at->format('d.m.Y H:i') }}</td>
            <td>
                @if ($invoice->status->value === 'AWAITING_PAYMENT')
                    <strong style="color: orange;">{{ $invoice->status->label() }}</strong>
                @elseif ($invoice->status->value === 'PAID')
                    <strong style="color: green;">{{ $invoice->status->label() }}</strong>
                @elseif ($invoice->status->value === 'CANCELLED')
                    <strong style="color: red">{{ $invoice->status->label() }}</strong>
                @else
                    {{ $invoice->status->label() }}                                    
                @endif
            </td>
            <td>
                @if ($invoice->status->value === 'AWAITING_PAYMENT' && (($company->status?->value ?? '') !== 'BLOCKED'))
                    <form method="POST" action="{{ route('admin.companies.invoices.approve', ['company' => $company->id, 'invoice' => $invoice->id]) }}" style="margin-bottom: 10px; display: inline-block;">
                        @csrf
                        @method('PATCH')
                        <button type="submit" class="btn btn-sm btn-success" onclick="return confirm('Вы уверены, что хотите подтвердить оплату этого счета? Подписка будет активирована.')">
                            Подтвердить
                        </button>
                    </form>
                    
                    <form method="POST" action="{{ route('admin.companies.invoices.cancel', ['company' => $company->id, 'invoice' => $invoice->id]) }}" style="margin-bottom: 10px; display: inline-block;">
                        @csrf
                        @method('PATCH')
                        <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('Вы уверены, что хотите отменить этот счет?')">
                            Отменить
                        </button>
                    </form>
                @endif
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    <form method="GET" action="{{ route('admin.companies.invoices.download', ['company' => $company->id, 'invoice' => $invoice->id]) }}" target="_blank">
                        <button type="submit">Счет</button>
                    </form>
                    <form method="GET" action="{{ route('admin.companies.invoices.download_upd', ['company' => $company->id, 'invoice' => $invoice->id]) }}" target="_blank">
                        <button type="submit">УПД</button>
                    </form>
                </div>
            </td>
        </tr>
        @if ($invoice->comment)
        <tr>
            <td colspan="7" style="padding: 10px; background-color: #f9f9f9; color: #555; font-size: 0.9em; border-top: none;">
                <strong>Примечание:</strong> {{ $invoice->comment }}
            </td>
        </tr>
        @endif
        @empty
        <tr>
            <td colspan="7">Счетов пока нет.</td>
        </tr>
        @endforelse
    </tbody>
</table>

<div style="margin-top: 15px;">
    {{ $invoices->links() }}
</div>

<script>
    document.addEventListener('DOMContentLoaded', function() {
        const tariffs = @json($tariffs->keyBy('id'));
        const select = document.getElementById('tariff_select');
        const detailsDiv = document.getElementById('tariff_details');

        function updateDetails() {
            const tariffId = select.value;
            const tariff = tariffs[tariffId];
            
            if (tariff) {
                const formatter = new Intl.NumberFormat('ru-RU');
                const priceFormatted = formatter.format(tariff.price);
                const limit = tariff.max_employees !== null ? tariff.max_employees + ' чел.' : 'Безлимит';
                const isPublic = tariff.is_public ? 'Да' : 'Нет (Индивидуальный)';

                detailsDiv.innerHTML = `
                    <div style="margin-bottom: 5px;"><strong>Стоимость:</strong> ${priceFormatted} ₽ / мес.</div>
                    <div style="margin-bottom: 5px;"><strong>Лимит сотрудников:</strong> ${limit}</div>
                    <div><strong>Публичный тариф:</strong> ${isPublic}</div>
                `;
                detailsDiv.style.display = 'block';
            } else {
                detailsDiv.style.display = 'none';
            }
        }

        if (select) {
            select.addEventListener('change', updateDetails);
            updateDetails();
        }
    });
</script>
@endsection