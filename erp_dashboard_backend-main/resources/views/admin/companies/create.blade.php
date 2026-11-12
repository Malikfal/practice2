@extends('admin.layout')

@section('title', 'Создать компанию')

@section('content')
    <p><a href="{{ route('admin.companies.index') }}">Назад к списку</a></p>

    <h2>Создать компанию</h2>

    @if ($errors->any())
        <ul>
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    @endif

    <form method="POST" action="{{ route('admin.companies.store') }}">
        @csrf

        <p>
            <label>
                Название компании<br>
                <input type="text" name="company_name" value="{{ old('company_name') }}" required>
            </label>
        </p>

        <p>
            <label>
                Имя владельца<br>
                <input type="text" name="owner_first_name" value="{{ old('owner_first_name') }}" required>
            </label>
        </p>

        <p>
            <label>
                Фамилия владельца<br>
                <input type="text" name="owner_last_name" value="{{ old('owner_last_name') }}" required>
            </label>
        </p>

        <p>
            <label>
                Email владельца<br>
                <input type="email" name="owner_email" value="{{ old('owner_email') }}" required>
            </label>
        </p>

        <p>
            <label>
                Пароль владельца<br>
                <input type="password" name="owner_password" required>
            </label>
        </p>

        <p>
            <label>
                Тарифный план<br>
                <select name="tariff_id" required>
                    @foreach ($tariffs as $tariff)
                        <option value="{{ $tariff->id }}" {{old('tariff_id') == $tariff->id ? 'selected' : ''}}>
                            {{$tariff->name}}
                            ({{$tariff->max_employees !== null  ? "лимит: {$tariff->max_employees} сотрудников" : "безлимит"}})
                        </option>
                    @endforeach
                </select>
            </label>
        </p>

        <p>
            <label>
                Период оплаты<br>
                <select name="period_months" required>
                    <option value="1" {{old('period_months') == '1' ? 'selected' : ''}}>1 месяц</option>
                    <option value="3" {{old('period_months') == '3' ? 'selected' : ''}}>3 месяца</option>
                    <option value="6" {{old('period_months') == '6' ? 'selected' : ''}}>6 месяцев</option>
                    <option value="12" {{old('period_months') == '12' ? 'selected' : ''}}>1 год</option>
                </select>
            </label>
        </p>

        <button type="submit">Создать</button>
    </form>
@endsection
