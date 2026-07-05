import { cleanText } from "./dom";

export function formatDurationFromSeconds(totalSeconds: number): string | null {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null;
  }

  const roundedSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const seconds = roundedSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value, index) =>
        index === 0 ? String(value) : String(value).padStart(2, '0'),
      )
      .join(':');
  }

  return [minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function normalizeIsoDateString(
  value: string | null | undefined,
): string | null {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  const timestamp = Date.parse(text);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp).toISOString();
  }

  return null;
}