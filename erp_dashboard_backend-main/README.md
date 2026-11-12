# Readme

## Применение миграций на сервере

```bash
docker compose exec backend php artisan migrate
```

## Очистка логов вручную

Очистит все логи, которые старше 'clean_after_days' (по дефолту 365).
Прописывается в config/activitylog.php
Сейчас routes/console.php сделан планировщик ежедневно запускающий команду
activitylog:clean --force и в конфиге зафиксировано 90 дней

На локлаке

```bash
php artisan activitylog:clean
```

На сервере

```bash
docker compose exec php artisan activitylog:clean
```

Дополнительные флаги:

Очистка логов конкретного канала (например task)

```bash
php artisan activitylog:clean my_log_name
```

Принудительная очистка (без ручного подтверждения)

```bash
php artisan activitylog:clean --force
```

Динамическое указание дней

```bash
php artisan activitylog:clean --days=30
```

Расчет зарплаты

```bash
docker compose exec backend php artisan payroll:accrue-daily
```

Запустить локально очередь импортов

```bash
php artisan queue:work database_import --queue=import --sleep=3 --tries=3 --timeout=630 --memory=1024
```

Запустить локально очередь перерасчетов оплаты труда

```bash
php artisan queue:work database_payroll_recalculation --queue=payroll_recalculation --sleep=3 --tries=1 --timeout=330 --memory=512
```
