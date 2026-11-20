import type { Dataset, Preview, Statistics } from "./types";
const base = "/api/backend/api/v1/datasets";
async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(base + path, { ...init, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error?.message ?? "ระบบวิเคราะห์ไม่พร้อมใช้งาน กรุณาลองอีกครั้ง",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function uploadDataset(file: File, signal: AbortSignal) {
  const body = new FormData();
  body.append("file", file);
  return request<Dataset>("", { method: "POST", body, signal });
}
export function selectSheet(id: string, name: string, signal: AbortSignal) {
  return request<Dataset>(`/${id}/sheet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheet_name: name }),
    signal,
  });
}
export function getPreview(
  id: string,
  params: { offset: number; limit: number; search: string },
  signal: AbortSignal,
) {
  return request<Preview>(
    `/${id}/preview?${new URLSearchParams({ offset: String(params.offset), limit: String(params.limit), search: params.search })}`,
    { signal },
  );
}
export function getStatistics(id: string, signal: AbortSignal) {
  return request<Statistics>(`/${id}/statistics`, { signal });
}
export function deleteDataset(id: string, signal: AbortSignal) {
  return request<void>(`/${id}`, { method: "DELETE", signal });
}
