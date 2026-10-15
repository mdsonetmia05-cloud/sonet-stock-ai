"use client";
import { useRef, useState, DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  accept,
  multiple = true,
  maxFiles,
  onFiles,
  label,
  hint,
  compact,
}: {
  accept: string;
  multiple?: boolean;
  maxFiles?: number;
  onFiles: (files: File[]) => void;
  label?: string;
  hint?: string;
  compact?: boolean;
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
        "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors",
        compact ? "px-4 py-6" : "px-6 py-12",
        dragging ? "border-primaryBright bg-primary/10" : "border-border bg-card hover:border-primary hover:bg-primary/5",
      )}
    >
      <UploadCloud size={compact ? 28 : 40} className="mb-3 text-primaryBright" aria-hidden />
      <p className="text-sm font-medium text-foreground">{label ?? "Drag and drop files here"}</p>
      <p className="mt-1 text-xs text-muted">or click to browse files</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
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
