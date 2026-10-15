/**
 * lib/csv.ts — CSV generation with correct escaping + UTF-8 BOM.
 * Excel/Sheets-safe: quotes, commas, newlines and unicode are handled.
 */

/** Escape one CSV field per RFC 4180. */
export function escapeCsvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  const lines: string[] = [];
  lines.push(columns.map(escapeCsvField).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(row[c])).join(","));
  }
  // UTF-8 BOM so Excel opens unicode correctly
  return "﻿" + lines.join("\r\n");
}

export function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

/** Build a CSV string and trigger a download. Returns byte size. */
export function downloadCsv(
  filename: string,
  columns: string[],
  rows: Array<Record<string, unknown>>,
): number {
  const csv = toCsv(columns, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename);
  return blob.size;
}
