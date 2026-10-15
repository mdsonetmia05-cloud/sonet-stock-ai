"use client";
import { useRef, useState, DragEvent } from "react";
import { Upload, Images } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  accept,
  multiple = true,
  maxFiles,
  onFiles,
  label,
  hint,
  compact,
  batchLimit,
  formats,
}: {
  accept: string;
  multiple?: boolean;
  maxFiles?: number;
  onFiles: (files: File[]) => void;
  label?: string;
  hint?: string;
  compact?: boolean;
  /** Shows the "BATCH LIMIT: N IMAGES" pill badge above the title. */
  batchLimit?: number;
  /** Small format pills rendered under the subtitle, e.g. ["PNG", "JPG", "WEBP"]. */
  formats?: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (list: FileList | File[]) => {
    let files = Array.from(list);
    if (maxFiles) files = files.slice(0, maxFiles);
    if (files.length) onFiles(files);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={label ?? "Upload files"}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-5 transition-colors",
          dragging ? "border-primaryBright bg-primary/10" : "border-border bg-card hover:border-primary/60",
        )}
      >
        <Upload size={18} className="text-primaryBright" aria-hidden />
        <p className="text-sm font-medium text-foreground">{label ?? "Add more files"}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          aria-hidden
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label ?? "Upload files"}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "mx-auto flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-3xl border px-6 py-14 text-center transition-colors",
        dragging
          ? "border-primaryBright bg-primary/10"
          : "border-border bg-card hover:border-primary/50",
      )}
    >
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
        <Upload size={24} className="text-foreground" aria-hidden />
      </span>
      {batchLimit != null && (
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-semibold tracking-wider text-muted">
          <Images size={12} aria-hidden />
          BATCH LIMIT: {batchLimit} IMAGES
        </span>
      )}
      <p className="text-base font-bold text-foreground">{label ?? "Drag and drop images (PNG, JPG, WebP)"}</p>
      <p className="mt-1.5 text-sm text-muted">or click to browse files</p>
      {formats && formats.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-hidden>
          {formats.map((f) => (
            <span
              key={f}
              className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted"
            >
              {f}
            </span>
          ))}
        </div>
      )}
      {hint && <p className="mt-3 max-w-md text-xs leading-relaxed text-muted">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        aria-hidden
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
