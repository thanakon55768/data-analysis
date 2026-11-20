export type Scalar = string | number | boolean | null;
export type Column = {
  id: string;
  label: string;
  dtype: "number" | "text" | "boolean" | "datetime" | "empty";
};
export type Dataset = {
  id: string;
  filename: string;
  sheets: { name: string }[];
  selected_sheet: string | null;
  status: "needs_sheet" | "ready";
  expires_at: string;
  warnings: string[];
};
export type Preview = {
  warnings: string[];
  truncated_cells: string[];
  columns: Column[];
  rows: Record<string, Scalar>[];
  total_rows: number;
  filtered_rows: number;
  offset: number;
  limit: number;
};
export type Numeric = {
  column_id: string;
  count: number;
  missing: number;
  sum: number | null;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
};
export type Statistics = {
  row_count: number;
  column_count: number;
  missing_cells: number;
  rows_with_missing: number;
  duplicate_rows: number;
  numeric: Numeric[];
  warnings: string[];
};
