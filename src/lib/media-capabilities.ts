import type {
  GenerationMode,
  MediaGenerationModels,
  MediaGenerationModes,
  RuntimeConfig,
} from "./types";

const MODE_VALUES = new Set<GenerationMode>(["auto", "ask", "off"]);

function parseMode(value: string | undefined, fallback: GenerationMode): GenerationMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized && MODE_VALUES.has(normalized as GenerationMode)) {
    return normalized as GenerationMode;
  }
  return fallback;
}

function parseModel(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function getDefaultMediaGenerationModes(): MediaGenerationModes {
  return {
    image: parseMode(process.env.SKYTELLS_IMAGE_GENERATION, "auto"),
    video: parseMode(process.env.SKYTELLS_VIDEO_GENERATION, "auto"),
    audio: parseMode(process.env.SKYTELLS_AUDIO_GENERATION, "auto"),
  };
}

export function getDefaultMediaGenerationModels(): MediaGenerationModels {
  return {
    image: parseModel(process.env.SKYTELLS_IMAGE_DEFAULT_MODEL, "FLUX.2-pro"),
    video: parseModel(process.env.SKYTELLS_VIDEO_DEFAULT_MODEL, "mera"),
    audio: parseModel(process.env.SKYTELLS_AUDIO_DEFAULT_MODEL, "beatfusion-2.0"),
  };
}

export function mergeMediaGenerationModes(
  defaults: MediaGenerationModes,
  overrides?: Partial<MediaGenerationModes> | null,
): MediaGenerationModes {
  return {
    image: parseMode(overrides?.image, defaults.image),
    video: parseMode(overrides?.video, defaults.video),
    audio: parseMode(overrides?.audio, defaults.audio),
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    mcpEnabled: process.env.MCP_ENABLED === "true",
    mediaGeneration: {
      modes: getDefaultMediaGenerationModes(),
      models: getDefaultMediaGenerationModels(),
    },
  };
}
