import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY = 10 * 1024 * 1024 + 64 * 1024;
const error = (status: number, code: string, message: string) =>
  Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const route = path.join("/");
  if (
    !/^api\/v1\/datasets(?:\/[0-9a-f-]{36}(?:\/(?:preview|statistics|sheet|chat|chart))?)?$/.test(
      route,
    )
  )
    return error(404, "not_found", "ไม่พบรายการที่ต้องการ");
  // Next may normalize nextUrl to localhost; compare Origin to the validated HTTP Host.
  const host = request.headers.get("host") ?? "";
  if (!/^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(host))
    return error(403, "local_only", "ระบบนี้ใช้ได้เฉพาะในเครื่อง");
  const origin = request.headers.get("origin");
  if (origin && origin !== `http://${host}`)
    return error(403, "origin_forbidden", "ไม่อนุญาตคำขอจากเว็บไซต์อื่น");
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY)
    return error(413, "file_too_large", "ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const value = await reader.read();
      if (value.done) break;
      length += value.value.length;
      if (length > MAX_BODY) {
        await reader.cancel();
        return error(413, "file_too_large", "ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
      }
      chunks.push(value.value);
    }
    body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
  }
  try {
    const upstream = new URL(
      process.env.FASTAPI_URL || "http://127.0.0.1:8000",
    );
    if (
      !["127.0.0.1", "localhost"].includes(upstream.hostname) ||
      upstream.protocol !== "http:"
    )
      return error(500, "invalid_configuration", "การตั้งค่าระบบวิเคราะห์ไม่ถูกต้อง");
    upstream.pathname = "/" + route;
    upstream.search = request.nextUrl.search;
    const headers = new Headers();
    const mode = process.env.NEXT_PUBLIC_STORAGE_MODE || "local";
    if (!["local", "supabase"].includes(mode))
      return error(503, "invalid_configuration", "โหมดจัดเก็บข้อมูลไม่ถูกต้อง");
    headers.set("x-storage-mode", mode);
    const authorization = request.headers.get("authorization");
    if (authorization) headers.set("authorization", authorization);
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(40_000)]),
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return error(
      503,
      "backend_unavailable",
      "ไม่สามารถเชื่อมต่อระบบวิเคราะห์ กรุณาตรวจสอบ Backend แล้วลองอีกครั้ง",
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
