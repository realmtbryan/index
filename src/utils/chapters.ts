import { Chapter, CustomShowTiming, Show } from '../types';
import { getNugsMetadataForDate } from '../data/nugsCatalog';
import { parseSetlist } from './shows';

/**
 * Format seconds into H:MM:SS (if >= 1 hour) or MM:SS.
 */
export function formatTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format a single track duration cleanly (e.g., 4:52, 16:52).
 */
export function formatDurationCompact(durationSeconds: number): string {
  const safe = Math.max(0, Math.round(durationSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse a "HH:MM:SS" or "MM:SS" or numeric seconds string into total seconds.
 */
export function parseDurationString(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const val = Number(trimmed);
    return Number.isFinite(val) && val > 0 ? val : null;
  }

  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

/**
 * Resolve track durations & set numbers for a show from (in priority order):
 * 1. User-saved custom timings (from Nugs JSON or manual durations)
 * 2. Show inline trackDurations
 * 3. Bundled verified Nugs catalog metadata by show date
 */
export function resolveTrackTimings(
  show: Show,
  customTiming?: CustomShowTiming | null
): { durations: number[]; sets?: number[]; isExact: boolean; sourceLabel?: string } | null {
  if (customTiming && customTiming.durations.length > 0) {
    return {
      durations: customTiming.durations,
      sets: customTiming.sets,
      isExact: true,
      sourceLabel: customTiming.sourceLabel ?? 'Custom Timings',
    };
  }

  if (show.trackDurations && show.trackDurations.length > 0) {
    return {
      durations: show.trackDurations,
      sets: show.trackSets,
      isExact: true,
      sourceLabel: 'Catalog Timings',
    };
  }

  const nugs = getNugsMetadataForDate(show.date);
  if (nugs?.trackDurations && nugs.trackDurations.length > 0) {
    return {
      durations: nugs.trackDurations,
      sets: nugs.trackSets,
      isExact: true,
      sourceLabel: `Nugs #${nugs.nugsShowId}`,
    };
  }

  return null;
}

/**
 * Compute cumulative chapter timestamps:
 * start[i] = max(0, syncOffsetSeconds + sum(durations[0..i-1]))
 *
 * When exact track durations exist, uses them directly.
 * When no durations exist but a total video duration is known (e.g., from YouTube/HTML5 API),
 * distributes proportional estimated chapters so users can still scrub setlists effortlessly.
 */
export function buildShowChapters(
  songs: string[],
  trackDurations?: number[],
  syncOffsetSeconds = 0,
  trackSets?: number[],
  fallbackTotalDuration?: number
): Chapter[] {
  if (songs.length === 0) return [];

  const hasExact = Array.isArray(trackDurations) && trackDurations.length > 0;

  let durations: number[];
  let isExact = false;

  if (hasExact && trackDurations) {
    isExact = true;
    const avg =
      trackDurations.reduce((acc, d) => acc + d, 0) / Math.max(1, trackDurations.length);
    durations = songs.map((_, i) => {
      const d = trackDurations[i];
      return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : Math.round(avg);
    });
  } else if (fallbackTotalDuration && fallbackTotalDuration > 60) {
    // Estimate realistic weights (Tuning/Intro shorter, regular tracks average)
    const weights = songs.map((song) => {
      const lower = song.toLowerCase();
      if (lower === 'tuning' || lower === 'intro' || lower === 'crowd') return 0.25;
      return 1;
    });
    const weightSum = weights.reduce((a, b) => a + b, 0);
    durations = weights.map((w) => Math.max(30, Math.round((w / weightSum) * fallbackTotalDuration)));
  } else {
    return [];
  }

  const chapters: Chapter[] = [];
  let cumulative = 0;

  for (let i = 0; i < songs.length; i += 1) {
    const duration = durations[i];
    const startTime = Math.max(0, Math.round(syncOffsetSeconds + cumulative));
    const endTime = startTime + duration;
    chapters.push({
      index: i,
      title: songs[i],
      startTime,
      endTime,
      duration,
      setNumber: trackSets?.[i],
      isExact,
    });
    cumulative += duration;
  }

  return chapters;
}

/**
 * Convenience helper to build chapters directly from a Show object.
 */
export function getChaptersForShow(
  show: Show,
  syncOffsetSeconds = 0,
  customTiming?: CustomShowTiming | null,
  fallbackTotalDuration?: number
): { chapters: Chapter[]; sourceLabel?: string; isExact: boolean } {
  const songs = parseSetlist(show.setlist);
  const resolved = resolveTrackTimings(show, customTiming);
  if (resolved) {
    return {
      chapters: buildShowChapters(
        songs,
        resolved.durations,
        syncOffsetSeconds,
        resolved.sets
      ),
      sourceLabel: resolved.sourceLabel,
      isExact: true,
    };
  }
  if (fallbackTotalDuration && fallbackTotalDuration > 60 && songs.length > 0) {
    return {
      chapters: buildShowChapters(songs, undefined, syncOffsetSeconds, undefined, fallbackTotalDuration),
      sourceLabel: 'Estimated from video length',
      isExact: false,
    };
  }
  return { chapters: [], isExact: false };
}

/**
 * Find the active chapter index for a given playback time in seconds.
 */
export function getActiveChapterIndex(chapters: Chapter[], currentTimeSeconds: number): number {
  if (chapters.length === 0) return -1;
  if (currentTimeSeconds < chapters[0].startTime) return 0;

  for (let i = chapters.length - 1; i >= 0; i -= 1) {
    if (currentTimeSeconds >= chapters[i].startTime) {
      return i;
    }
  }
  return 0;
}

export function getSetLabel(setNumber?: number): string | null {
  if (!setNumber) return null;
  if (setNumber === 4) return 'Encore';
  if (setNumber === 5) return 'Encore 2';
  return `Set ${setNumber}`;
}

/**
 * Parse user-pasted Nugs `/api/v1/shows/{id}` JSON response, tracks array JSON,
 * OR plain newline/comma-separated durations (`01:06, 03:14, 06:44...`) into CustomShowTiming.
 */
export function parseCustomTimingsInput(rawInput: string): CustomShowTiming | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Attempt JSON parsing (Nugs show container response or tracks array)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const trackList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.Response?.tracks)
        ? parsed.Response.tracks
        : Array.isArray(parsed?.tracks)
        ? parsed.tracks
        : Array.isArray(parsed?.Response?.songs)
        ? parsed.Response.songs
        : null;

      if (trackList && trackList.length > 0) {
        const durations: number[] = [];
        const sets: number[] = [];
        let hasSets = false;

        for (const item of trackList) {
          if (typeof item === 'number' && Number.isFinite(item) && item > 0) {
            durations.push(Math.round(item));
            continue;
          }
          const rawDur =
            item?.totalRunningTime ??
            item?.duration ??
            item?.durationSeconds ??
            item?.length ??
            item?.hhmmssTotalRunningTime;

          let secs: number | null = null;
          if (typeof rawDur === 'number' && Number.isFinite(rawDur) && rawDur > 0) {
            secs = Math.round(rawDur);
          } else if (typeof rawDur === 'string') {
            secs = parseDurationString(rawDur);
          }

          if (secs !== null && secs > 0) {
            durations.push(secs);
            const setNum = Number(item?.setNum ?? item?.setNumber ?? item?.set);
            if (Number.isFinite(setNum) && setNum > 0) {
              sets.push(setNum);
              hasSets = true;
            } else {
              sets.push(1);
            }
          }
        }

        if (durations.length > 0) {
          const containerId = parsed?.Response?.containerID ?? parsed?.id;
          return {
            durations,
            sets: hasSets ? sets : undefined,
            sourceLabel: containerId ? `Nugs #${containerId}` : 'Imported Nugs JSON',
          };
        }
      }
    } catch {
      // Fall through to plain-text parsing
    }
  }

  // Plain-text duration lines / comma-separated durations (e.g., "01:06", "Tuning 01:06", "66, 194, 404")
  const tokens = trimmed
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const durations: number[] = [];
  for (const token of tokens) {
    // Match trailing duration like "07 Heartbeat Of America 16:52" or standalone "16:52" or "1012"
    const timeMatch = token.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*$/);
    if (timeMatch) {
      const secs = parseDurationString(timeMatch[1]);
      if (secs !== null) durations.push(secs);
      continue;
    }
    const direct = parseDurationString(token);
    if (direct !== null) {
      durations.push(direct);
    }
  }

  if (durations.length > 0) {
    return {
      durations,
      sourceLabel: 'Custom Track Durations',
    };
  }

  return null;
}
