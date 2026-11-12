<?php

namespace App\Services\Workspace;

use App\Exports\FinanceExport;
use App\Repositories\Workspace\FinanceRepository;
use Maatwebsite\Excel\Excel as ExcelWriter;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class FinanceExportService
{
    public function __construct(
        private readonly FinanceRepository $financesRepository,
    ) {}

    public function download(array $data, string $companyId): BinaryFileResponse
    {
        $format = $data['format'];
        unset($data['format']);

        $writerType = $format === 'csv' ? ExcelWriter::CSV : ExcelWriter::XLSX;

        return Excel::download(
            new FinanceExport($this->financesRepository->all($companyId, $data)),
            "finances.{$format}",
            $writerType,
        );
    }
}
