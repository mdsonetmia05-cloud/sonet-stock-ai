import type { JobType } from "./db";

/** Route to reopen a job of a given type in its tool. */
export const JOB_ROUTE: Record<JobType, string> = {
  "image-to-prompt": "/image-to-prompt",
  metadata: "/metadata-generator",
  prompt: "/prompt-generator",
  batch: "/batch-editor",
  "bg-remove": "/background-remover",
  upscale: "/image-upscaler",
  qc: "/rejection-predictor",
  research: "/stock-analysis",
};

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  "image-to-prompt": "Image to Prompt",
  metadata: "Metadata",
  prompt: "Prompt",
  batch: "Batch",
  "bg-remove": "BG Remover",
  upscale: "Upscaler",
  qc: "QC / Rejection check",
  research: "Research",
};
