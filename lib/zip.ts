/**
 * lib/zip.ts — ZIP export helpers (client-side, jszip).
 */
import JSZip from "jszip";
import { downloadBlob } from "./csv";

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/** Create a ZIP from in-memory blobs and trigger a download. Returns byte size. */
export async function downloadZip(filename: string, entries: ZipEntry[]): Promise<number> {
  const zip = new JSZip();
  for (const e of entries) {
    zip.file(e.name, e.blob);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  downloadBlob(blob, filename);
  return blob.size;
}
