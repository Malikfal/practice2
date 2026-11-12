<?php

namespace Tests\Unit\Http;

use App\Http\Controllers\Api\Workspace\PayrollRecalculationController;
use App\Http\Requests\Workspace\PayrollRecalculationRequest;
use App\Models\User;
use App\Services\Workspace\PayrollRecalculationService;
use Mockery;
use Tests\TestCase;

class PayrollRecalculationControllerTest extends TestCase
{
    /** Проверяет ответ для периода, перерасчет которого еще не запускался. */
    public function test_show_returns_null_data_when_recalculation_does_not_exist(): void
    {
        $actor = new User(['id' => 'actor']);
        $request = Mockery::mock(PayrollRecalculationRequest::class);
        $request->shouldReceive('user')->once()->andReturn($actor);
        $request->shouldReceive('validated')->once()->with('period_from')->andReturn('2026-08-17');
        $request->shouldReceive('validated')->once()->with('period_to')->andReturn('2026-08-23');

        $service = Mockery::mock(PayrollRecalculationService::class);
        $service->shouldReceive('show')
            ->once()
            ->with($actor, '2026-08-17', '2026-08-23')
            ->andReturnNull();

        $response = (new PayrollRecalculationController($service))->show($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(['data' => null], $response->getData(true));
    }
}
