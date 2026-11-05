/**
 * Formatação de duração para as telas de estudo.
 *
 * Duas formas: `formatStudyDuration` para resumos ("2h 05min") e
 * `formatClockDuration` para relógio ("02:05:09").
 */

/** `7500` vira `2h 05min`; `1800` vira `30min`; `45` vira `45s`. */
export function formatStudyDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  }

  if (minutes > 0) {
    return `${minutes}min`;
  }

  return `${safe}s`;
}

/** `7509` vira `02:05:09`; abaixo de 1h vira `MM:SS`. */
export function formatClockDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return hours > 0 ? `${String(hours).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}
