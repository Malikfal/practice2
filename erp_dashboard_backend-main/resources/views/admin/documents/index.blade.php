@extends('admin.layout')

@section('title', 'Документы')

@section('content')
    <h2>Управление документами</h2>

    @if(session('success'))
        <p style="color: green; font-weight: bold;">{{ session('success') }}</p>
    @endif

    @if($errors->any())
        <div style="color: red; margin-bottom: 20px;">
            <strong>Ошибка загрузки:</strong>
            <ul>
                @foreach($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <fieldset style="margin-bottom: 30px; padding: 15px;">
        <legend><b>Добавить новый документ</b></legend>
        <form action="{{ route('admin.documents.store') }}" method="POST" enctype="multipart/form-data">
            @csrf
            
            <p>
                <label>Название (для UI):</label><br>
                <input type="text" name="title" required placeholder="Например: Договор Оферты" style="width: 300px;">
            </p>

            <p>
                <label>Файл (PDF):</label><br>
                <input type="file" name="document" required>
            </p>

            <p>
                <input type="checkbox" name="is_public" id="is_public" value="1">
                <label for="is_public">Сделать публичным</label>
            </p>

            <button type="submit">Загрузить</button>
        </form>
    </fieldset>

    <h3>Список документов</h3>
    <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; text-align: left;">
        <thead>
            <tr>
                <th style="width: 25%;">Название</th>
                <th style="width: 25%;">Оригинальный файл</th>
                <th>Доступ</th>
                <th>Дата загрузки</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($documents as $doc)
                <tr>
                    <td style="max-width: 250px; word-wrap: break-word; overflow-wrap: break-word;">{{ $doc->title }}</td>
                    <td style="max-width: 250px; word-break: break-all;">{{ $doc->original_name }}</td>
                    <td>
                        @if($doc->is_public)
                            <span style="color: green;">Публичный</span>
                        @else
                            <span style="color: red;">Только Админам</span>
                        @endif
                    </td>
                    <td>{{ $doc->created_at->format('d.m.Y H:i') }}</td>
                    <td>
                        <a href="{{ route('admin.documents.download', $doc) }}"><button type="submit">Скачать</button></a>
                        
                        <form method="POST" action="{{ route('admin.documents.destroy', $doc) }}" onsubmit="return confirm('Точно удалить документ?');">
                            @csrf
                            @method('DELETE')
                            <button type="submit">Удалить</button>
                        </form>
                        
                        <form method="POST" action="{{ route('admin.documents.change_status', $doc) }}">
                            @csrf
                            @method('PATCH')
                            <input type="hidden" name="is_public" value="{{ $doc->is_public ? 0 : 1 }}">

                            <label style="cursor: pointer;">
                                <input type="checkbox" name="is_public" value="1"
                                    {{ $doc->is_public ? 'checked' : '' }}
                                    onchange="this.form.submit()"> Публичный доступ
                            </label>
                        </form>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5">Документов пока нет.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
@endsection