<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('skills')) {
            Schema::create('skills', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('name', 80);
                $table->string('normalized_name', 80);
                $table->timestamps();

                $table->unique(['company_id', 'normalized_name']);
                $table->index(['company_id', 'name']);
            });
        }

        if (! Schema::hasTable('employee_skills')) {
            Schema::create('employee_skills', function (Blueprint $table): void {
                $table->id();
                $table->foreignUuid('employee_id')->constrained('users')->cascadeOnDelete();
                $table->foreignUuid('skill_id')->constrained('skills')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['employee_id', 'skill_id']);
                $table->index(['employee_id', 'skill_id']);
            });
        }

        $users = DB::table('users')
            ->select(['id', 'company_id', 'skills'])
            ->whereNotNull('skills')
            ->where('skills', '!=', '')
            ->get();

        foreach ($users as $user) {
            $companyId = (string) ($user->company_id ?? '');
            $employeeId = (string) ($user->id ?? '');
            $rawSkills = (string) ($user->skills ?? '');

            if ($companyId === '' || $employeeId === '' || trim($rawSkills) === '') {
                continue;
            }

            $skillNames = collect(explode(',', $rawSkills))
                ->map(static fn (string $value): string => trim(preg_replace('/\s+/', ' ', $value) ?? ''))
                ->filter(static fn (string $value): bool => $value !== '')
                ->unique(static fn (string $value): string => mb_strtolower($value))
                ->values();

            foreach ($skillNames as $skillName) {
                $normalizedName = mb_strtolower($skillName);

                $skill = DB::table('skills')->where([
                    'company_id' => $companyId,
                    'normalized_name' => $normalizedName,
                ])->first();

                $skillId = $skill?->id;

                if (! is_string($skillId) || $skillId === '') {
                    $skillId = (string) Str::uuid();
                    DB::table('skills')->insert([
                        'id' => $skillId,
                        'company_id' => $companyId,
                        'name' => $skillName,
                        'normalized_name' => $normalizedName,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                DB::table('employee_skills')->updateOrInsert(
                    [
                        'employee_id' => $employeeId,
                        'skill_id' => $skillId,
                    ],
                    [
                        'updated_at' => now(),
                        'created_at' => now(),
                    ],
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_skills');
        Schema::dropIfExists('skills');
    }
};

