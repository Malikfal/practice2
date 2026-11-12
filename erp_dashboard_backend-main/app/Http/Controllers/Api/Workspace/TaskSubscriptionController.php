<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Enums\TaskSubscriptionMode;
use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Services\Notifications\TaskSubscriptionService;
use App\Support\TaskAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Кнопка «Следить / Не уведомлять» в окне задачи.
 */
class TaskSubscriptionController extends Controller
{
    public function __construct(
        private readonly TaskSubscriptionService $subscriptions,
    ) {}

    public function show(Request $request, Task $task): JsonResponse
    {
        abort_unless(TaskAccess::canView($request->user(), $task), 404);

        return response()->json(['data' => $this->subscriptions->state($request->user(), $task)]);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        abort_unless(TaskAccess::canView($request->user(), $task), 404);
        $data = $request->validate([
            'mode' => ['present', 'nullable', Rule::enum(TaskSubscriptionMode::class)->only([TaskSubscriptionMode::WATCH, TaskSubscriptionMode::MUTE])],
        ]);
        $mode = $data['mode'] !== null ? TaskSubscriptionMode::from($data['mode']) : null;

        return response()->json(['data' => $this->subscriptions->update($request->user(), $task, $mode)]);
    }
}
