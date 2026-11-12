@extends('admin.layout')

@section('title', 'Карточка компании')

@section('content')
<p><a href="{{ route('admin.companies.index') }}">Назад к списку</a></p>

<h2>Карточка компании</h2>

<div style="margin-bottom: 20px; padding: 10px; background: #f0f0f0;">
    <a href="{{ route('admin.companies.show', $company) }}" style="margin-right: 15px; font-weight: bold;">Общая информация</a>
    <a href="{{ route('admin.companies.billing', $company) }}">Биллинг и тарифы</a>
</div>

<p><strong>ID:</strong> {{ $company->id }}</p>
<p><strong>Название:</strong> {{ $company->name }}</p>
<p><strong>Статус:</strong> {{ $company->status?->value }}</p>
<p><strong>Владелец:</strong> {{ $company->owner?->email ?? 'Не назначен' }}</p>
<p><strong>Текущий тариф:</strong> {{ $company->tariff?->name ?? 'Не назначен' }}</p>

<!-- <div>
    @if (($company->status?->value ?? '') !== 'BLOCKED')
    <form method="POST" action="{{ route('admin.companies.update_tariff', $company)}}">
        @csrf
        @method('PATCH')

        <label for="tariff_select"><strong>Сменить тарифный план:</strong></label>
        <select name="tariff_id" id="tariff_select" required>
            @foreach ($tariffs as $tariff)
                <option value="{{ $tariff->id }}" {{ $company->tariff_id === $tariff->id ? 'selected' : '' }}>
                    {{ $tariff->name }} 
                    ({{ $tariff->max_employees !== null ? "лимит: {$tariff->max_employees} сотр." : 'безлимит' }})
                </option>
            @endforeach
        </select>

        <button type="submit">Применить</button>
    </form>
    @endif
</div> -->

<div>
    @if (($company->status?->value ?? '') === 'BLOCKED')
    <form method="POST" action="{{ route('admin.companies.unblock', $company) }}">
        @csrf
        @method('PATCH')
        <button type="submit">Разблокировать компанию</button>
    </form>
    @else
    <form method="POST" action="{{ route('admin.companies.block', $company) }}">
        @csrf
        @method('PATCH')
        <button type="submit">Заблокировать компанию</button>
    </form>
    @endif
</div>

<div>
    <form method="POST" action="{{ route('admin.companies.login_as_owner', $company) }}">
        @csrf
        <button type="submit">Войти от имени владельца</button>
    </form>
</div>

<h3>Сотрудники</h3>
<table border="1" cellpadding="6" cellspacing="0">
    <thead>
        <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Имя</th>
            <th>Роль</th>
            <th>Статус</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($employees as $employee)
        <tr>
            <td>{{ $employee->id }}</td>
            <td>{{ $employee->email }}</td>
            <td>{{ trim($employee->name . ' ' . $employee->last_name) }}</td>
            <td>{{ $employee->role }}</td>
            <td>{{ $employee->status }}</td>
        </tr>
        @empty
        <tr>
            <td colspan="5">Сотрудников нет.</td>
        </tr>
        @endforelse
    </tbody>
</table>

{{ $employees->links() }}
@endsection
