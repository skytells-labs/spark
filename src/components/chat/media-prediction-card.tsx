"use client";

import * as React from "react";
import {
  ExternalLink,
  ImageIcon,
  Loader2,
  Music2,
  Video,
  XCircle,
} from "lucide-react";
import type { AgentStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MediaPredictionCardProps {
  step: AgentStep;
}

function mediaLabel(kind: AgentStep["mediaKind"]) {
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  return "Image";
}

function primaryIcon(step: AgentStep) {
  if (step.status === "running") return Loader2;
  if (step.status === "error") return XCircle;
  if (step.mediaKind === "video") return Video;
  if (step.mediaKind === "audio") return Music2;
  return ImageIcon;
}

export function MediaPredictionCard({ step }: MediaPredictionCardProps) {
  const urls = (step.sources ?? []).map((source) => source.url).filter(Boolean);
  const primaryUrl = urls[0] ?? "";
  const Icon = primaryIcon(step);

  const statusText =
    step.status === "running"
      ? "Predicting"
      : step.status === "error"
        ? "Failed"
        : "Success";

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="mb-2 flex items-start gap-2">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            step.status === "running"
              ? "animate-spin text-muted-foreground"
              : step.status === "error"
                ? "text-red-300/85"
                : "text-emerald-300/85",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5">
              Skytells Prediction
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5",
                step.status === "running"
                  ? "border-sky-400/35 text-sky-300"
                  : step.status === "error"
                    ? "border-red-400/35 text-red-300"
                    : "border-emerald-400/35 text-emerald-300",
              )}
            >
              {statusText}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-white/88">
            {mediaLabel(step.mediaKind)} generation {statusText.toLowerCase()}
            {step.mediaModel ? ` via ${step.mediaModel}` : ""}
          </p>
          <p className="mt-1 text-xs text-white/60">{step.detail}</p>
          {step.predictionId ? (
            <p className="mt-1 font-mono text-[11px] text-white/42">
              prediction: {step.predictionId}
            </p>
          ) : null}
        </div>
      </div>

      {primaryUrl ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/40 p-2">
          {step.mediaKind === "video" ? (
            <video
              src={primaryUrl}
              controls
              className="max-h-[260px] w-full rounded-md bg-black"
              preload="metadata"
            />
          ) : step.mediaKind === "audio" ? (
            <audio src={primaryUrl} controls className="w-full" preload="metadata" />
          ) : (
            <img src={primaryUrl} alt={step.title} className="max-h-[260px] w-auto rounded-md object-contain" />
          )}
        </div>
      ) : null}

      {urls.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {urls.slice(0, 3).map((url) => (
            <a
              key={`${step.id}-${url}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-white/14 px-2 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Preview
              <ExternalLink className="size-3" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
