<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ClientIndexRequest;
use App\Http\Requests\Workspace\ClientViewRequest;
use App\Http\Requests\Workspace\DeleteClientRequest;
use App\Http\Requests\Workspace\StoreClientContactRequest;
use App\Http\Requests\Workspace\StoreClientLegalEntityBankDetailRequest;
use App\Http\Requests\Workspace\StoreClientLegalEntityRequest;
use App\Http\Requests\Workspace\StoreClientRequest;
use App\Http\Requests\Workspace\UpdateClientContactRequest;
use App\Http\Requests\Workspace\UpdateClientLegalEntityBankDetailRequest;
use App\Http\Requests\Workspace\UpdateClientLegalEntityRequest;
use App\Http\Requests\Workspace\UpdateClientRequest;
use App\Http\Responses\Workspace\ClientContactIndexResponse;
use App\Http\Responses\Workspace\ClientContactResponse;
use App\Http\Responses\Workspace\ClientIndexResponse;
use App\Http\Responses\Workspace\ClientLegalEntityBankDetailIndexResponse;
use App\Http\Responses\Workspace\ClientLegalEntityBankDetailResponse;
use App\Http\Responses\Workspace\ClientLegalEntityIndexResponse;
use App\Http\Responses\Workspace\ClientLegalEntityResponse;
use App\Http\Responses\Workspace\ClientResponse;
use App\Models\Client;
use App\Models\ClientContact;
use App\Models\ClientLegalEntity;
use App\Models\ClientLegalEntityBankDetail;
use App\Services\Workspace\ClientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class ClientController extends Controller
{
    public function __construct(
        private readonly ClientService $clients,
    ) {}

    public function index(ClientIndexRequest $request): JsonResponse
    {
        return new ClientIndexResponse(
            $this->clients->paginate($request->validated(), $this->companyId($request))
        );
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        return new ClientResponse(
            $this->clients->create($request->validated(), $this->companyId($request)),
            201,
        );
    }

    public function show(ClientViewRequest $request, Client $client): JsonResponse
    {
        return new ClientResponse(
            $this->clients->show($client, $this->companyId($request)),
        );
    }

    public function update(UpdateClientRequest $request, Client $client): JsonResponse
    {
        return new ClientResponse(
            $this->clients->update($client, $request->validated(), $this->companyId($request)),
        );
    }

    public function destroy(DeleteClientRequest $request, Client $client): Response
    {
        $this->clients->delete($client, $this->companyId($request));

        return response()->noContent();
    }

    public function contacts(ClientViewRequest $request, Client $client): JsonResponse
    {
        return new ClientContactIndexResponse(
            $this->clients->contacts($client, $this->companyId($request)),
        );
    }

    public function storeContact(StoreClientContactRequest $request, Client $client): JsonResponse
    {
        return new ClientContactResponse(
            $this->clients->createContact($client, $request->validated(), $this->companyId($request)),
            201,
        );
    }

    public function showContact(
        ClientViewRequest $request,
        Client $client,
        ClientContact $contact,
    ): JsonResponse {
        return new ClientContactResponse(
            $this->clients->showContact($client, $contact, $this->companyId($request)),
        );
    }

    public function updateContact(
        UpdateClientContactRequest $request,
        Client $client,
        ClientContact $contact,
    ): JsonResponse {
        return new ClientContactResponse(
            $this->clients->updateContact($client, $contact, $request->validated(), $this->companyId($request)),
        );
    }

    public function destroyContact(
        DeleteClientRequest $request,
        Client $client,
        ClientContact $contact,
    ): Response {
        $this->clients->deleteContact($client, $contact, $this->companyId($request));

        return response()->noContent();
    }

    public function legalEntities(ClientViewRequest $request, Client $client): JsonResponse
    {
        return new ClientLegalEntityIndexResponse(
            $this->clients->legalEntities($client, $this->companyId($request)),
        );
    }

    public function storeLegalEntity(StoreClientLegalEntityRequest $request, Client $client): JsonResponse
    {
        return new ClientLegalEntityResponse(
            $this->clients->createLegalEntity($client, $request->validated(), $this->companyId($request)),
            201,
        );
    }

    public function showLegalEntity(
        ClientViewRequest $request,
        Client $client,
        ClientLegalEntity $legalEntity,
    ): JsonResponse {
        return new ClientLegalEntityResponse(
            $this->clients->showLegalEntity($client, $legalEntity, $this->companyId($request)),
        );
    }

    public function updateLegalEntity(
        UpdateClientLegalEntityRequest $request,
        Client $client,
        ClientLegalEntity $legalEntity,
    ): JsonResponse {
        return new ClientLegalEntityResponse(
            $this->clients->updateLegalEntity($client, $legalEntity, $request->validated(), $this->companyId($request)),
        );
    }

    public function destroyLegalEntity(
        DeleteClientRequest $request,
        Client $client,
        ClientLegalEntity $legalEntity,
    ): Response {
        $this->clients->deleteLegalEntity($client, $legalEntity, $this->companyId($request));

        return response()->noContent();
    }

    public function bankDetails(
        ClientViewRequest $request,
        Client $client,
        ClientLegalEntity $legalEntity,
    ): JsonResponse {
        return new ClientLegalEntityBankDetailIndexResponse(
            $this->clients->bankDetails($client, $legalEntity, $this->companyId($request)),
        );
    }

    public function storeBankDetail(
        StoreClientLegalEntityBankDetailRequest $request,
        Client $client,
        ClientLegalEntity $legalEntity,
    ): JsonResponse {
        return new ClientLegalEntityBankDetailResponse(
            $this->clients->createBankDetail($client, $legalEntity, $request->validated(), $this->companyId($request)),
            201,
        );
    }

    public function showBankDetail(
        ClientViewRequest $request,
        Client $client,
        ClientLegalEntity $legalEntity,
        ClientLegalEntityBankDetail $bankDetail,
    ): JsonResponse {
        return new ClientLegalEntityBankDetailResponse(
            $this->clients->showBankDetail($client, $legalEntity, $bankDetail, $this->companyId($request)),
        );
    }

    public function updateBankDetail(
        UpdateClientLegalEntityBankDetailRequest $request,
        Client $client,
        ClientLegalEntity $legalEntity,
        ClientLegalEntityBankDetail $bankDetail,
    ): JsonResponse {
        return new ClientLegalEntityBankDetailResponse(
            $this->clients->updateBankDetail(
                $client,
                $legalEntity,
                $bankDetail,
                $request->validated(),
                $this->companyId($request),
            ),
        );
    }

    public function destroyBankDetail(
        DeleteClientRequest $request,
        Client $client,
        ClientLegalEntity $legalEntity,
        ClientLegalEntityBankDetail $bankDetail,
    ): Response {
        $this->clients->deleteBankDetail($client, $legalEntity, $bankDetail, $this->companyId($request));

        return response()->noContent();
    }
}
