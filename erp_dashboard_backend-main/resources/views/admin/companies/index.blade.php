@extends('admin.layout')

@section('title', 'Компании')

@section('content')
    <h2>Список компаний</h2>
    <p><a href="{{ route('admin.companies.create') }}">Создать компанию</a></p>

    <table border="1" cellpadding="6" cellspacing="0">
        <thead>
            <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Статус</th>
                <th>Тариф</th>
                <th>Владелец</th>
                <th>Сотрудники</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($companies as $company)
                <tr>
                    <td>{{ $company->id }}</td>
                    <td>
                        <a href="{{ route('admin.companies.show', $company) }}">{{ $company->name }}</a>
                    </td>
                    <td>{{ $company->status?->value }}</td>
                    <td>{{ $company->tariff?->name ?? 'не назначен'}}</td>
                    <td>{{ $company->owner?->email ?? 'Не назначен' }}</td>
                    <td>{{ $company->employees_count }}</td>
                    <td>
                        @if (($company->status?->value ?? '') === 'BLOCKED')
                            <form method="POST" action="{{ route('admin.companies.unblock', $company) }}">
                                @csrf
                                @method('PATCH')
                                <button type="submit">Разблокировать</button>
                            </form>
                        @else
                            <form method="POST" action="{{ route('admin.companies.block', $company) }}">
                                @csrf
                                @method('PATCH')
                                <button type="submit">Заблокировать</button>
                            </form>
                        @endif
                        <form method="POST" action="{{ route('admin.companies.login_as_owner', $company) }}">
                            @csrf
                            <button type="submit">Войти от имени владельца</button>
                        </form>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="7">Компаний пока нет.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    {{ $companies->links() }}
@endsection
