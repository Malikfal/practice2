<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subjectLine }}</title>
</head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;padding:32px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
                <tr>
                    <td style="padding:28px 28px 8px;font-size:20px;font-weight:bold;color:#1f3565;">ФЛОУ</td>
                </tr>
                <tr>
                    <td style="padding:8px 28px 0;font-size:16px;font-weight:bold;">{{ $greeting }}</td>
                </tr>
                <tr>
                    <td style="padding:12px 28px 0;font-size:14px;line-height:22px;color:#334155;">{{ $intro }}</td>
                </tr>
                <tr>
                    <td style="padding:24px 28px;">
                        <a href="{{ $actionUrl }}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:10px;">{{ $actionLabel }}</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding:0 28px;font-size:12px;line-height:18px;color:#64748b;">
                        Если кнопка не открывается, скопируйте ссылку в браузер:<br>
                        <a href="{{ $actionUrl }}" style="color:#2563eb;word-break:break-all;">{{ $actionUrl }}</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding:16px 28px 28px;font-size:12px;line-height:18px;color:#64748b;">{{ $outro }}</td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
