import type { Dataset } from "./types";
export function SheetSelector({
  dataset,
  busy,
  onSelect,
}: {
  dataset: Dataset;
  busy: boolean;
  onSelect: (name: string) => void;
}) {
  if (!dataset.sheets.length) return null;
  return (
    <div className="sheet-picker">
      <label htmlFor="sheet">ชีตที่ต้องการวิเคราะห์</label>
      <select
        id="sheet"
        disabled={busy}
        value={dataset.selected_sheet ?? ""}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="" disabled>
          เลือกชีต
        </option>
        {dataset.sheets.map((sheet) => (
          <option key={sheet.name} value={sheet.name}>
            {sheet.name}
          </option>
        ))}
      </select>
    </div>
  );
}
