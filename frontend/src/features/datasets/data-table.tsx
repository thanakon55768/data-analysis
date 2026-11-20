"use client";
import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Table2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import type { Preview, Scalar } from "./types";
const dtypeLabels: Record<string, string> = {
  number: "ตัวเลข",
  text: "ข้อความ",
  boolean: "จริง/เท็จ",
  datetime: "วันที่",
  empty: "ค่าว่าง",
};
export function DataTable({
  preview,
  busy,
  search,
  onSearch,
  onPage,
  previousOffset,
}: {
  preview: Preview | null;
  busy: boolean;
  search: string;
  onSearch: (value: string) => void;
  onPage: (offset: number) => void;
  previousOffset: number;
}) {
  const columns = useMemo<ColumnDef<Record<string, Scalar>>[]>(
    () =>
      preview?.columns.map((column) => ({
        accessorKey: column.id,
        header: () => (
          <>
            <span>{column.label || "(ไม่มีชื่อ)"}</span>
            <small>
              {dtypeLabels[column.dtype] || column.dtype} · {column.id}
            </small>
          </>
        ),
        cell: ({ getValue }) => {
          const value = getValue<Scalar>();
          return value === null ? (
            <span className="missing" title="ค่าว่าง">
              —
            </span>
          ) : (
            String(value)
          );
        },
      })) ?? [],
    [preview?.columns],
  );
  const rows = preview?.rows ?? [];
  // React Compiler is not enabled; TanStack v8 intentionally exposes mutable table methods.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });
  return (
    <section aria-labelledby="preview-heading">
      <div className="section-heading">
        <h2 id="preview-heading">ตัวอย่างข้อมูล</h2>
        {preview ? (
          <label className="search">
            <Search aria-hidden="true" />
            <input
              type="search"
              aria-label="ค้นหาในข้อมูล"
              placeholder="ค้นหาในข้อมูล…"
              maxLength={200}
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
        ) : null}
      </div>
      {!preview ? (
        <Empty className="empty-state">
          <Table2 aria-hidden="true" />
          <EmptyHeader>
            <EmptyTitle>ยังไม่มีข้อมูล</EmptyTitle>
            <EmptyDescription>อัปโหลดไฟล์เพื่อดูตารางและสถิติ</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="ตารางข้อมูล เลื่อนแนวนอนได้"
            aria-busy={busy}
          >
            <table>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th key={header.id} scope="col">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length ? (
              <p className="no-results">ไม่พบข้อมูลที่ตรงกับคำค้นหา</p>
            ) : null}
          </div>
          <div className="pagination">
            <p aria-live="polite">
              พบ {preview.filtered_rows.toLocaleString("th-TH")} จาก{" "}
              {preview.total_rows.toLocaleString("th-TH")} แถว
            </p>
            <div>
              <Button
                variant="outline"
                size="sm"
                aria-label="หน้าก่อนหน้า"
                disabled={busy || preview.offset === 0}
                onClick={() => onPage(previousOffset)}
              >
                <ChevronLeft data-icon="inline-start" />
                ก่อนหน้า
              </Button>
              <span>
                {preview.filtered_rows ? preview.offset + 1 : 0}–
                {Math.min(
                  preview.offset + preview.rows.length,
                  preview.filtered_rows,
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                aria-label="หน้าถัดไป"
                disabled={
                  busy ||
                  preview.offset + preview.limit >= preview.filtered_rows
                }
                onClick={() => onPage(preview.offset + preview.limit)}
              >
                ถัดไป
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
