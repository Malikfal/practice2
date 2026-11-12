<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Admin')</title>
</head>
<body>
    <header>
        <h1>Admin</h1>
        @auth
            <form method="POST" action="{{ route('admin.logout') }}">
                @csrf
                <button type="submit">Выйти</button>
            </form>
        @endauth
        
        @if(!request()->routeIs('admin.documents.index') && !request()->routeIs('admin.login'))
            <p><a href="{{ route('admin.documents.index') }}">Перейти к списку документов</a></p>
        @endif

        @if(!request()->routeIs('admin.companies.index') && !request()->routeIs('admin.login'))
            <p><a href="{{ route('admin.companies.index') }}">Перейти к списку компаний</a></p>
        @endif

        @if(!request()->routeIs('admin.settings.requisites') && !request()->routeIs('admin.login'))
            <p><a href="{{ route('admin.settings.requisites') }}">Реквизиты платформы</a></p>
        @endif


        @if (!empty($companySwitcherCompanies) && count($companySwitcherCompanies) > 0)
            <div>
                <strong>Переключение компании:</strong>
                @foreach ($companySwitcherCompanies as $switchCompany)
                    @if (($currentCompanyId ?? null) === $switchCompany->id)
                        <strong>{{ $switchCompany->name }}</strong>
                    @else
                        <a href="{{ route('admin.companies.show', $switchCompany) }}">{{ $switchCompany->name }}</a>
                    @endif
                    @if (! $loop->last)
                        |
                    @endif
                @endforeach
            </div>
        @endif
        <hr>
    </header>

    @if (session('status'))
        <p>{{ session('status') }}</p>
    @endif

    @if ($errors->any())
        <ul>
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    @endif

    <main>
        @yield('content')
    </main>
</body>
</html>
