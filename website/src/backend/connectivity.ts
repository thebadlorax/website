/**
 * author thebadlorax
 * created on 24-02-2026-17h-08m
 * github: https://github.com/thebadlorax
 * copyright 2026
*/

export const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Content-Disposition",
    "Access-Control-Max-Age": "86400",
} satisfies HeadersInit;

export function corsResponse(
    body: BodyInit | null,
    init: ResponseInit = {}
  ): Response {
    return new Response(body, {
      ...init,
      headers: {
        ...CORS_HEADERS,
        ...(init.headers ?? {}),
      },
    });
}