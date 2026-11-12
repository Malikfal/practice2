<?php

namespace App\Support;

use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

class AuthCookieService
{
    public function withAuthCookies(
        Response $response,
        array $tokens,
        int $accessTokenTtlSeconds,
        int $refreshTokenTtlSeconds,
    ): Response {
        $this->withExpiredLegacyRefreshCookies($response);
        $response->headers->setCookie(
            $this->makeCookie('erp_access_token', $tokens['accessToken'], $accessTokenTtlSeconds),
        );
        $response->headers->setCookie(
            $this->makeCookie('erp_refresh_token', $tokens['refreshToken'], $refreshTokenTtlSeconds),
        );

        return $response;
    }

    public function clearAuthCookies(Response $response): Response
    {
        $this->withExpiredLegacyRefreshCookies($response);
        $response->headers->setCookie($this->expiredCookie('erp_access_token'));
        $response->headers->setCookie($this->expiredCookie('erp_refresh_token'));

        return $response;
    }

    public function clearLegacyApiRefreshCookie(Response $response): Response
    {
        return $this->withExpiredLegacyRefreshCookies($response);
    }

    private function makeCookie(string $name, string $value, int $ttlSeconds): Cookie
    {
        return cookie(
            $name,
            $value,
            (int) ceil($ttlSeconds / 60),
            '/',
            $this->cookieDomain(),
            $this->usesSecureCookies(),
            true,
            false,
            'lax',
        );
    }

    private function expiredCookie(string $name): Cookie
    {
        return $this->expiredCookieFor($name, '/', $this->cookieDomain());
    }

    private function expiredLegacyRefreshCookie(): Cookie
    {
        return $this->expiredCookieFor('erp_refresh_token', '/api', $this->apiCookieDomain());
    }

    private function expiredLegacyHostRefreshCookie(): Cookie
    {
        return $this->expiredCookieFor('erp_refresh_token', '/api', null);
    }

    private function withExpiredLegacyRefreshCookies(Response $response): Response
    {
        $response->headers->setCookie($this->expiredLegacyHostRefreshCookie());
        $response->headers->setCookie($this->expiredLegacyRefreshCookie());

        return $response;
    }

    private function expiredCookieFor(string $name, string $path, ?string $domain): Cookie
    {
        return cookie(
            $name,
            '',
            -1,
            $path,
            $domain,
            $this->usesSecureCookies(),
            true,
            false,
            'lax',
        );
    }

    private function cookieDomain(): ?string
    {
        $domain = trim((string) env('AUTH_COOKIE_DOMAIN', ''));

        return $domain !== '' ? $domain : null;
    }

    private function apiCookieDomain(): ?string
    {
        $domain = trim((string) env('AUTH_LEGACY_API_COOKIE_DOMAIN', 'api.flow-erp.ru'));

        return $domain !== '' ? $domain : null;
    }

    private function usesSecureCookies(): bool
    {
        $appUrl = (string) config('app.url', '');

        return parse_url($appUrl, PHP_URL_SCHEME) === 'https';
    }
}
