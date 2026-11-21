import { authHeaders } from "@/features/auth/client";
import type { Dataset, Preview, Statistics } from "./types";
const base = "/api/backend/api/v1/datasets";
async function request<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(await authHeaders()))
    headers.set(key, value);
  const response = await fetch(base + path, {
    ...init,
    headers,
    cache: "no-store",
  });
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

export function listDatasets(offset: number, signal: AbortSignal) {
  return request<(Dataset & { deleting?: boolean })[]>(
    `?offset=${offset}&limit=20`,
    { signal },
  );
}
export function getDataset(id: string, signal: AbortSignal) {
  return request<Dataset>(`/${id}`, { signal });
}
export type ChatTurn = {
  id: string;
  question: string;
  answer: string;
  evidence: Record<string, unknown> | null;
  warnings: string[];
  created_at: string;
  computed_answer?: string;
  explanation_by_ai?: boolean;
};
export function getChat(id: string, signal: AbortSignal) {
  return request<ChatTurn[]>(`/${id}/chat`, { signal });
}
export function askQuestion(
  id: string,
  question: string,
  signal: AbortSignal,
  options?: { share_analysis: boolean; expected_sheet: string },
) {
  return request<ChatTurn>(`/${id}/chat`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, share_with_gemini: true, ...options }),
  });
}
export type ChartResult = {
  group_column: import("./types").Column;
  value_column: import("./types").Column | null;
  metric: string;
  groups: { group: string | null; value: number | null }[];
  row_count: number;
  warnings: string[];
};
export function getChart(
  id: string,
  params: {
    group_id: string;
    metric: string;
    value_id?: string;
    expected_sheet: string;
  },
  signal: AbortSignal,
) {
  return request<ChartResult>(`/${id}/chart?${new URLSearchParams(params)}`, {
    signal,
  });
}
export type DataFilter = {
  column_id: string;
  operator: "eq" | "contains" | "gte" | "lte" | "missing" | "after" | "before";
  value: string;
};
export type VisualizationSpec = {
  mode: "aggregate" | "time" | "scatter" | "histogram";
  group_id: string;
  value_id?: string;
  metric: string;
  interval: string;
  bins: number;
  filters: DataFilter[];
  expected_sheet: string;
};
export type VisualizationResult = {
  mode: string;
  points: { x: number; value: number | null; label: string; upper?: number }[];
  group_column: import("./types").Column;
  value_column: import("./types").Column | null;
  metric: string;
  source_rows: number;
  filtered_rows: number;
  excluded_rows: number;
  sample_count: number | null;
  warnings: string[];
  filters: DataFilter[];
};
export function getVisualization(
  id: string,
  spec: VisualizationSpec,
  signal: AbortSignal,
) {
  return request<VisualizationResult>(`/${id}/visualization`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  });
}
