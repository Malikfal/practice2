<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    protected function companyId(Request $request): string
    {
        return (string) $request->attributes->get('company_id', $request->input('company_id', ''));
    }
}
