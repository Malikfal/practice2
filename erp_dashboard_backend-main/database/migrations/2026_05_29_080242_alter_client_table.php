<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('clients') && ! Schema::hasColumn('clients', 'description')) {
            Schema::table('clients', function (Blueprint $table): void {
                $table->text('description')->nullable()->after('name');
            });
        }

        if (! Schema::hasTable('client_contacts')) {
            Schema::create('client_contacts', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('client_id')->constrained('clients')->cascadeOnDelete();
                $table->string('first_name');
                $table->string('last_name')->nullable();
                $table->string('middle_name')->nullable();
                $table->string('email')->nullable();
                $table->string('phone')->nullable();
                $table->string('position')->nullable();
                $table->text('comments')->nullable();
                $table->jsonb('payload')->nullable();
                $table->timestamps();

                $table->index(['client_id', 'last_name', 'first_name']);
            });
        }

        if (! Schema::hasTable('client_legal_entities')) {
            Schema::create('client_legal_entities', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('client_id')->constrained('clients')->cascadeOnDelete();
                $table->string('name');
                $table->text('legal_address');
                $table->string('postal_code', 32);
                $table->string('inn', 32);
                $table->string('kpp', 32)->nullable();
                $table->string('ogrn', 32)->nullable();
                $table->string('signer_last_name')->nullable();
                $table->string('signer_first_name')->nullable();
                $table->string('signer_middle_name')->nullable();
                $table->string('signer_position')->nullable();
                $table->string('phone')->nullable();
                $table->string('email')->nullable();
                $table->timestamps();

                $table->index(['client_id', 'name']);
                $table->index(['client_id', 'inn']);
            });
        }

        if (! Schema::hasTable('client_legal_entity_bank_details')) {
            Schema::create('client_legal_entity_bank_details', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('client_legal_entity_id')
                    ->constrained('client_legal_entities')
                    ->cascadeOnDelete();
                $table->string('checking_account', 64);
                $table->string('bank');
                $table->string('bik', 32);
                $table->string('correspondent_account', 64);
                $table->timestamps();

                $table->index(['client_legal_entity_id', 'bank']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('client_legal_entity_bank_details');
        Schema::dropIfExists('client_legal_entities');
        Schema::dropIfExists('client_contacts');

        if (Schema::hasTable('clients') && Schema::hasColumn('clients', 'description')) {
            Schema::table('clients', function (Blueprint $table): void {
                $table->dropColumn('description');
            });
        }
    }
};
