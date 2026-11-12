<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            
            $table->uuid('company_id')->index();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');

            $table->uuid('tariff_id')->index();
            $table->foreign('tariff_id')->references('id')->on('tariffs')->onDelete('restrict');

            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable(); // null, на случай если подписка бессрочная

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
