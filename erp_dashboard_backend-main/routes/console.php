<?php

use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\SuperAdminAndCompanySeeder;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('permissions:refresh {--with-superadmin : Also run superadmin/company bootstrap seeder}', function () {
    $this->components->info('Refreshing roles and permissions...');

    $this->call('db:seed', [
        '--class' => RolePermissionSeeder::class,
        '--force' => true,
    ]);

    if ($this->option('with-superadmin')) {
        $this->newLine();
        $this->components->info('Running superadmin/company bootstrap seeder...');

        $this->call('db:seed', [
            '--class' => SuperAdminAndCompanySeeder::class,
            '--force' => true,
        ]);
    }

    $this->newLine();
    $this->components->success('Roles and permissions were refreshed successfully.');
    $this->line('Safe default: direct user permissions and denied permissions were not reset.');
    $this->line('Run: php artisan permissions:refresh');
    $this->line('Optional bootstrap: php artisan permissions:refresh --with-superadmin');
})->purpose('Safely refresh role and permission seed data without running the full DatabaseSeeder');
