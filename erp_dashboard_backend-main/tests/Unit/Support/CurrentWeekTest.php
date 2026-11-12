<?php

namespace Tests\Unit\Support;

use App\Support\CurrentWeek;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CurrentWeekTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('timezone')->nullable();
        });
        DB::table('companies')->insert([
            ['id' => 'moscow', 'timezone' => 'Europe/Moscow'],
            ['id' => 'utc', 'timezone' => 'UTC'],
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    public function test_bounds_return_monday_to_next_monday(): void
    {
        [$from, $to] = CurrentWeek::bounds('utc', Carbon::parse('2026-07-09 15:30:00', 'UTC'));

        $this->assertSame('2026-07-06 00:00:00', $from->toDateTimeString());
        $this->assertSame('2026-07-13 00:00:00', $to->toDateTimeString());
    }

    public function test_week_starts_on_monday_midnight_in_company_timezone(): void
    {
        // Понедельник 01:00 по Москве — это еще воскресенье 22:00 по UTC, но уже новая неделя компании.
        Carbon::setTestNow(Carbon::parse('2026-07-12 22:00:00', 'UTC'));

        [$from, $to] = CurrentWeek::bounds('moscow');

        $this->assertSame('Europe/Moscow', $from->timezoneName);
        $this->assertSame('2026-07-13 00:00:00', $from->toDateTimeString());
        $this->assertSame('2026-07-20 00:00:00', $to->toDateTimeString());
        $this->assertSame(Carbon::parse('2026-07-12 21:00:00', 'UTC')->timestamp, $from->timestamp);

        [$utcFrom] = CurrentWeek::bounds('utc');
        $this->assertSame('2026-07-06 00:00:00', $utcFrom->toDateTimeString());
    }
}
