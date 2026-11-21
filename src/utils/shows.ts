import { GroupedShow, Show, SimilarShowMatch } from '../types';
import { getNugsMetadataForDate } from '../data/nugsCatalog';
import { getVideoInfo } from './video';

export type CollectionFilter =
  | 'video'
  | 'all'
  | 'youtube'
  | 'drive'
  | 'setlist'
  | 'none'
  | 'saved'
  | 'recent';

export type SortOrder = 'desc' | 'asc';

export interface YearSummary {
  year: number;
  total: number;
  videoCount: number;
  youtubeCount: number;
  driveCount: number;
  setlistCount: number;
}

export interface ArchiveStats {
  total: number;
  videoCount: number;
  youtubeCount: number;
  driveCount: number;
  setlistCount: number;
  noVideoCount: number;
  hiddenRecapCount: number;
  years: YearSummary[];
}

export interface FilterOptions {
  searchQuery: string;
  selectedYear: number | 'All';
  collection: CollectionFilter;
  sortOrder: SortOrder;
  savedIds: Set<string>;
  recentIds: string[];
  selectedSongs?: string[];
}

export interface SongIndexEntry {
  title: string;
  normalized: string;
  totalShows: number;
  playableShows: number;
}

const RECAP_OR_PROMO_PATTERN =
  /\((?:recap|clip|promo|preview|trailer|teaser|highlight|highlights)\)|\b(?:show recap|tour recap|livestream preview|subscriber livestream|set preview|promo video|official trailer|teaser clip)\b/i;

/**
 * Verified Nugs Subscriber Livestream opener previews / promo clips (e.g. ~17m YouTube promos
 * carrying "SUBSCRIBER LIVESTREAM" banners and zero full-show setlist) that otherwise clutter
 * the top of the Watchable & YouTube feeds.
 */
const KNOWN_LIVESTREAM_PREVIEW_IDS = new Set([
  '2026-04-02-1489',
  '2026-10-03-extra',
  '2026-10-06-extra',
  '2026-10-23-extra',
  '2026-10-24-extra',
  '2026-10-30-extra',
  '2026-10-31-extra',
]);

/**
 * Globally identify recaps, clips, and promo/livestream-preview videos that should be hidden by default.
 */
export function isRecapOrPromo(show: Show): boolean {
  if (show.sourceType === 'recap') return true;
  if (KNOWN_LIVESTREAM_PREVIEW_IDS.has(show.id)) return true;
  if (RECAP_OR_PROMO_PATTERN.test(show.venue)) return true;
  if (show.notes && RECAP_OR_PROMO_PATTERN.test(show.notes)) return true;
  return false;
}

export function formatLocation(show: Show): string {
  return [show.city, show.state].filter(Boolean).join(', ');
}

export function formatShowHeading(show: Show): string {
  return getBaseVenueName(show.venue);
}

export function formatShowFullTitle(show: Show): string {
  const loc = formatLocation(show);
  return `${show.artist} — ${show.date} — ${getBaseVenueName(show.venue)}${loc ? ` (${loc})` : ''}`;
}

export function formatReadableDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [year, month, day] = parts;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

export function dateToEpochDay(dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
}

/**
 * Parse pipe-separated setlist string into an array of clean song titles.
 */
export function parseSetlist(setlist?: string): string[] {
  if (!setlist) return [];
  return setlist
    .split('|')
    .map((song) => song.trim())
    .filter((song) => song.length > 0);
}

/**
 * Normalize a song title for reliable setlist overlap and multi-song filtering
 * (ignores punctuation, apostrophes, extra spaces, and case).
 */
export function normalizeSongTitle(song: string): string {
  return song
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE_TRACKS = new Set(['tuning', 'intro', 'crowd', 'banter', 'encore break', 'set break']);

export function isMeaningfulSong(song: string): boolean {
  const norm = normalizeSongTitle(song);
  return norm.length > 0 && !NOISE_TRACKS.has(norm);
}

/**
 * Strip trailing "(Part N)" or "(Set N)" suffix from venue names to identify multi-part recordings
 * from the same performance.
 */
export function getBaseVenueName(venue: string): string {
  return venue
    .replace(/\s*\(Part\s+\d+\)\s*$/i, '')
    .replace(/\s*\(Recap\)\s*$/i, '')
    .trim();
}

export function extractPartNumber(venue: string): number {
  const match = venue.match(/\(Part\s+(\d+)\)/i);
  return match ? Number(match[1]) : 1;
}

export function getPartLabel(show: Show, siblingCount: number): string | null {
  const match = show.venue.match(/\(Part\s+(\d+)\)/i);
  if (match) return `Part ${match[1]}`;
  if (siblingCount > 1) return 'Part 1';
  return null;
}

export function getPerformanceGroupKey(show: Show): string {
  return `${show.date}::${getBaseVenueName(show.venue).toLowerCase()}`;
}

/**
 * Find all non-recap parts / videos recorded on the same date and base venue.
 */
export function getSameShowParts(shows: Show[], target: Show): Show[] {
  const baseVenue = getBaseVenueName(target.venue).toLowerCase();
  const matches = shows.filter(
    (s) =>
      !isRecapOrPromo(s) &&
      s.date === target.date &&
      getBaseVenueName(s.venue).toLowerCase() === baseVenue
  );
  if (matches.length <= 1) return [];
  return matches.sort((a, b) => {
    const partA = extractPartNumber(a.venue);
    const partB = extractPartNumber(b.venue);
    return partA - partB || a.id.localeCompare(b.id);
  });
}

/**
 * Collapse split shows sharing the same date and base venue into unified GroupedShow cards,
 * globally filtering out recaps/promos by default and enriching with verified Nugs catalog metadata.
 */
export function groupShowsByPerformance(
  shows: Show[],
  includeRecaps = false
): GroupedShow[] {
  const buckets = new Map<string, Show[]>();

  for (const show of shows) {
    if (!includeRecaps && isRecapOrPromo(show)) continue;
    const key = getPerformanceGroupKey(show);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(show);
    } else {
      buckets.set(key, [show]);
    }
  }

  const groups: GroupedShow[] = [];

  for (const [groupKey, rawParts] of buckets.entries()) {
    const sortedParts = [...rawParts].sort((a, b) => {
      const partA = extractPartNumber(a.venue);
      const partB = extractPartNumber(b.venue);
      return partA - partB || a.id.localeCompare(b.id);
    });

    const playableParts = sortedParts.filter((p) => getVideoInfo(p.videoUrl) !== null);
    const canonical = playableParts[0] ?? sortedParts[0];
    const displayVenue = getBaseVenueName(canonical.venue);

    // Merge metadata from sibling parts so the unified card never loses setlist/notes/lineup
    const mergedSetlist =
      canonical.setlist || sortedParts.find((p) => p.setlist && p.setlist.trim())?.setlist;
    const mergedNotes =
      canonical.notes || sortedParts.find((p) => p.notes && p.notes.trim())?.notes;
    const mergedBand =
      canonical.bandMembers || sortedParts.find((p) => p.bandMembers)?.bandMembers;
    const mergedReviews =
      canonical.reviews || sortedParts.find((p) => p.reviews)?.reviews;

    const nugs = getNugsMetadataForDate(canonical.date);

    const enrichedParts = sortedParts.map((part) => ({
      ...part,
      setlist: part.setlist || mergedSetlist,
      notes: part.notes || mergedNotes,
      bandMembers: part.bandMembers || mergedBand,
      reviews: part.reviews || mergedReviews,
      nugsShowId: part.nugsShowId || nugs?.nugsShowId,
      nugsArtworkUrl: part.nugsArtworkUrl || nugs?.artworkUrl,
      trackDurations: part.trackDurations || nugs?.trackDurations,
      trackSets: part.trackSets || nugs?.trackSets,
    }));

    const primaryShow =
      enrichedParts.find((p) => p.id === canonical.id) ?? enrichedParts[0];

    let hasYouTube = false;
    let hasDrive = false;
    for (const part of playableParts) {
      const info = getVideoInfo(part.videoUrl);
      if (info?.source === 'youtube') hasYouTube = true;
      if (info?.source === 'drive') hasDrive = true;
    }

    groups.push({
      groupKey,
      primaryShow,
      displayVenue,
      parts: enrichedParts,
      playablePartCount: playableParts.length,
      hasPlayableVideo: playableParts.length > 0,
      hasYouTube,
      hasDrive,
      hasChapters: Boolean(
        primaryShow.trackDurations && primaryShow.trackDurations.length > 0
      ),
    });
  }

  return groups;
}

export function computeArchiveStats(shows: Show[]): ArchiveStats {
  const hiddenRecapCount = shows.filter((s) => isRecapOrPromo(s)).length;
  const groups = groupShowsByPerformance(shows, false);
  return computeGroupedArchiveStats(groups, hiddenRecapCount);
}

export function computeGroupedArchiveStats(
  groups: GroupedShow[],
  hiddenRecapCount = 0
): ArchiveStats {
  const yearMap = new Map<number, YearSummary>();
  let videoCount = 0;
  let youtubeCount = 0;
  let driveCount = 0;
  let setlistCount = 0;
  let noVideoCount = 0;

  for (const group of groups) {
    const show = group.primaryShow;
    let summary = yearMap.get(show.year);
    if (!summary) {
      summary = {
        year: show.year,
        total: 0,
        videoCount: 0,
        youtubeCount: 0,
        driveCount: 0,
        setlistCount: 0,
      };
      yearMap.set(show.year, summary);
    }

    summary.total += 1;
    if (group.hasPlayableVideo) {
      videoCount += 1;
      summary.videoCount += 1;
      if (group.hasYouTube) {
        youtubeCount += 1;
        summary.youtubeCount += 1;
      }
      if (group.hasDrive) {
        driveCount += 1;
        summary.driveCount += 1;
      }
    } else {
      noVideoCount += 1;
    }

    if (show.setlist && show.setlist.trim().length > 0) {
      setlistCount += 1;
      summary.setlistCount += 1;
    }
  }

  const years = Array.from(yearMap.values()).sort((a, b) => b.year - a.year);

  return {
    total: groups.length,
    videoCount,
    youtubeCount,
    driveCount,
    setlistCount,
    noVideoCount,
    hiddenRecapCount,
    years,
  };
}

export function matchesSearchQuery(show: Show, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  const haystack = [
    show.artist,
    show.date,
    String(show.year),
    getBaseVenueName(show.venue),
    show.venue,
    show.city,
    show.state,
    show.setlist ?? '',
    show.notes ?? '',
    show.bandMembers ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export function matchesSelectedSongs(show: Show, selectedSongs?: string[]): boolean {
  if (!selectedSongs || selectedSongs.length === 0) return true;
  const songs = parseSetlist(show.setlist);
  if (songs.length === 0) return false;

  const normalizedSet = new Set(songs.map(normalizeSongTitle));
  return selectedSongs.every((wanted) => {
    const normWanted = normalizeSongTitle(wanted);
    if (!normWanted) return true;
    if (normalizedSet.has(normWanted)) return true;
    // Allow partial substring match (e.g., "Heartbeat Of America")
    for (const candidate of normalizedSet) {
      if (candidate.includes(normWanted)) return true;
    }
    return false;
  });
}

export function filterAndSortGroupedShows(
  groups: GroupedShow[],
  options: FilterOptions
): GroupedShow[] {
  const {
    searchQuery,
    selectedYear,
    collection,
    sortOrder,
    savedIds,
    recentIds,
    selectedSongs = [],
  } = options;

  const groupHasSaved = (g: GroupedShow) =>
    g.parts.some((p) => savedIds.has(p.id));

  if (collection === 'recent') {
    const byShowId = new Map<string, GroupedShow>();
    for (const g of groups) {
      for (const p of g.parts) {
        byShowId.set(p.id, g);
      }
    }
    const seenGroups = new Set<string>();
    const ordered: GroupedShow[] = [];
    for (const id of recentIds) {
      const g = byShowId.get(id);
      if (!g || seenGroups.has(g.groupKey)) continue;
      seenGroups.add(g.groupKey);
      if (selectedYear !== 'All' && g.primaryShow.year !== selectedYear) continue;
      if (!matchesSearchQuery(g.primaryShow, searchQuery)) continue;
      if (!matchesSelectedSongs(g.primaryShow, selectedSongs)) continue;
      ordered.push(g);
    }
    return ordered;
  }

  const filtered = groups.filter((group) => {
    const show = group.primaryShow;
    if (selectedYear !== 'All' && show.year !== selectedYear) return false;
    if (!matchesSearchQuery(show, searchQuery)) return false;
    if (!matchesSelectedSongs(show, selectedSongs)) return false;

    switch (collection) {
      case 'video':
        return group.hasPlayableVideo;
      case 'youtube':
        return group.hasYouTube;
      case 'drive':
        return group.hasDrive;
      case 'setlist':
        return Boolean(show.setlist && show.setlist.trim().length > 0);
      case 'none':
        return !group.hasPlayableVideo;
      case 'saved':
        return groupHasSaved(group);
      case 'all':
      default:
        return true;
    }
  });

  return filtered.sort((a, b) => {
    const dateCmp = a.primaryShow.date.localeCompare(b.primaryShow.date);
    if (dateCmp !== 0) return sortOrder === 'asc' ? dateCmp : -dateCmp;
    return a.displayVenue.localeCompare(b.displayVenue);
  });
}

/**
 * Legacy-compatible flat helper that delegates to grouped filtering (recaps excluded).
 */
export function filterAndSortShows(shows: Show[], options: FilterOptions): Show[] {
  const groups = groupShowsByPerformance(shows, false);
  return filterAndSortGroupedShows(groups, options).map((g) => g.primaryShow);
}

/**
 * Count how many archive-only (no video) grouped shows also match the user's current
 * search, song filter, and year when browsing a video-only collection.
 */
export function countHiddenArchiveMatches(
  showsOrGroups: Show[] | GroupedShow[],
  searchQuery: string,
  selectedYear: number | 'All',
  collection: CollectionFilter,
  selectedSongs: string[] = []
): number {
  if (!searchQuery.trim() && selectedSongs.length === 0) return 0;
  if (
    collection === 'all' ||
    collection === 'none' ||
    collection === 'saved' ||
    collection === 'recent' ||
    collection === 'setlist'
  ) {
    return 0;
  }

  const groups: GroupedShow[] =
    showsOrGroups.length > 0 && 'groupKey' in showsOrGroups[0]
      ? (showsOrGroups as GroupedShow[])
      : groupShowsByPerformance(showsOrGroups as Show[], false);

  let count = 0;
  for (const group of groups) {
    if (group.hasPlayableVideo) continue;
    if (selectedYear !== 'All' && group.primaryShow.year !== selectedYear) continue;
    if (!matchesSearchQuery(group.primaryShow, searchQuery)) continue;
    if (!matchesSelectedSongs(group.primaryShow, selectedSongs)) continue;
    count += 1;
  }
  return count;
}

/**
 * Build a deduplicated song index across the archive for fast multi-song autocomplete.
 */
export function buildSongIndex(groups: GroupedShow[]): SongIndexEntry[] {
  const map = new Map<string, SongIndexEntry>();

  for (const group of groups) {
    const songs = parseSetlist(group.primaryShow.setlist);
    const seenInShow = new Set<string>();
    for (const rawSong of songs) {
      if (!isMeaningfulSong(rawSong)) continue;
      const norm = normalizeSongTitle(rawSong);
      if (seenInShow.has(norm)) continue;
      seenInShow.add(norm);

      const existing = map.get(norm);
      if (existing) {
        existing.totalShows += 1;
        if (group.hasPlayableVideo) existing.playableShows += 1;
      } else {
        map.set(norm, {
          title: rawSong,
          normalized: norm,
          totalShows: 1,
          playableShows: group.hasPlayableVideo ? 1 : 0,
        });
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.playableShows - a.playableShows ||
      b.totalShows - a.totalShows ||
      a.title.localeCompare(b.title)
  );
}

/**
 * Find playable, non-recap shows that share the most songs with the target show,
 * ranked by overlap count (then Jaccard similarity and date proximity).
 */
export function findSimilarShows(
  groups: GroupedShow[],
  targetShow: Show,
  limit = 16
): SimilarShowMatch[] {
  const targetSongs = parseSetlist(targetShow.setlist).filter(isMeaningfulSong);
  if (targetSongs.length === 0) return [];

  const targetKey = getPerformanceGroupKey(targetShow);
  const targetNormMap = new Map<string, string>();
  for (const s of targetSongs) {
    const norm = normalizeSongTitle(s);
    if (!targetNormMap.has(norm)) targetNormMap.set(norm, s);
  }

  const targetDay = dateToEpochDay(targetShow.date);
  const matches: SimilarShowMatch[] = [];

  for (const group of groups) {
    if (group.groupKey === targetKey) continue;
    if (!group.hasPlayableVideo) continue;

    const candidateSongs = parseSetlist(group.primaryShow.setlist).filter(isMeaningfulSong);
    if (candidateSongs.length === 0) continue;

    const candidateNorms = new Set(candidateSongs.map(normalizeSongTitle));
    const shared: string[] = [];

    for (const [norm, displayTitle] of targetNormMap.entries()) {
      if (candidateNorms.has(norm)) {
        shared.push(displayTitle);
      }
    }

    if (shared.length === 0) continue;

    const unionSize = targetNormMap.size + candidateNorms.size - shared.length;
    const similarityScore = unionSize > 0 ? shared.length / unionSize : 0;

    matches.push({
      group,
      overlapCount: shared.length,
      matchingSongs: shared,
      similarityScore,
    });
  }

  return matches
    .sort((a, b) => {
      if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
      if (b.similarityScore !== a.similarityScore) {
        return b.similarityScore - a.similarityScore;
      }
      const distA = Math.abs(dateToEpochDay(a.group.primaryShow.date) - targetDay);
      const distB = Math.abs(dateToEpochDay(b.group.primaryShow.date) - targetDay);
      return distA - distB;
    })
    .slice(0, limit);
}

/**
 * Build a clean, playable-only "Up Next" queue of distinct performances:
 * - Strictly excludes unplayable Archive-only entries and recaps
 * - Excludes sibling parts of the current show (handled in the player's Part Switcher)
 * - Orders logically: chronological tour neighbors (same year/closest dates) first,
 *   then setlist-similar playable shows, then remaining playable shows in the active list.
 */
export function getUpNextGroups(
  filteredGroups: GroupedShow[],
  allGroups: GroupedShow[],
  selectedShow: Show,
  limit = 20
): GroupedShow[] {
  const currentGroupKey = getPerformanceGroupKey(selectedShow);
  const seen = new Set<string>([currentGroupKey]);
  const result: GroupedShow[] = [];

  const pushPlayableUnique = (list: GroupedShow[]) => {
    for (const g of list) {
      if (result.length >= limit) break;
      if (!g.hasPlayableVideo) continue;
      if (isRecapOrPromo(g.primaryShow)) continue;
      if (seen.has(g.groupKey)) continue;
      seen.add(g.groupKey);
      result.push(g);
    }
  };

  const targetDay = dateToEpochDay(selectedShow.date);

  // 1. Chronological tour neighbors from the same tour year (sorted by closest date proximity)
  const sameYearNeighbors = allGroups
    .filter((g) => g.hasPlayableVideo && g.primaryShow.year === selectedShow.year && g.groupKey !== currentGroupKey)
    .sort((a, b) => {
      const distA = Math.abs(dateToEpochDay(a.primaryShow.date) - targetDay);
      const distB = Math.abs(dateToEpochDay(b.primaryShow.date) - targetDay);
      return distA - distB || a.primaryShow.date.localeCompare(b.primaryShow.date);
    })
    .slice(0, 10);
  pushPlayableUnique(sameYearNeighbors);

  // 2. Top setlist-similar playable shows (if current show has a setlist)
  const similar = findSimilarShows(allGroups, selectedShow, 8).map((m) => m.group);
  pushPlayableUnique(similar);

  // 3. Remaining playable shows from the active filtered view
  pushPlayableUnique(filteredGroups);

  // 4. Nearest chronological playable shows across adjacent years if queue is still short
  if (result.length < limit) {
    const nearestOverall = allGroups
      .filter((g) => g.hasPlayableVideo && !seen.has(g.groupKey))
      .sort((a, b) => {
        const distA = Math.abs(dateToEpochDay(a.primaryShow.date) - targetDay);
        const distB = Math.abs(dateToEpochDay(b.primaryShow.date) - targetDay);
        return distA - distB;
      });
    pushPlayableUnique(nearestOverall);
  }

  return result.slice(0, limit);
}

/**
 * Legacy-compatible Up Next helper returning flat playable Show[].
 */
export function getUpNextShows(
  pool: Show[],
  allShows: Show[],
  selectedShow: Show,
  limit = 20
): Show[] {
  const poolGroups = groupShowsByPerformance(pool, false);
  const allGroups = groupShowsByPerformance(allShows, false);
  return getUpNextGroups(poolGroups, allGroups, selectedShow, limit).map((g) => g.primaryShow);
}

/**
 * Pick a random playable, non-recap grouped show from the preferred pool, falling back to any playable show.
 */
export function pickRandomPlayableGroup(
  preferredPool: GroupedShow[],
  allGroups: GroupedShow[],
  excludeGroupKey?: string,
  rng: () => number = Math.random
): GroupedShow | null {
  const playablePreferred = preferredPool.filter(
    (g) => g.hasPlayableVideo && !isRecapOrPromo(g.primaryShow) && g.groupKey !== excludeGroupKey
  );
  const candidates =
    playablePreferred.length > 0
      ? playablePreferred
      : allGroups.filter(
          (g) => g.hasPlayableVideo && !isRecapOrPromo(g.primaryShow) && g.groupKey !== excludeGroupKey
        );

  if (candidates.length === 0) return null;
  const idx = Math.floor(rng() * candidates.length);
  return candidates[idx] ?? candidates[0];
}

export function pickRandomPlayableShow(
  preferredPool: Show[],
  allShows: Show[],
  excludeId?: string,
  rng: () => number = Math.random
): Show | null {
  const excludeShow = allShows.find((s) => s.id === excludeId);
  const excludeKey = excludeShow ? getPerformanceGroupKey(excludeShow) : undefined;
  const picked = pickRandomPlayableGroup(
    groupShowsByPerformance(preferredPool, false),
    groupShowsByPerformance(allShows, false),
    excludeKey,
    rng
  );
  return picked?.primaryShow ?? null;
}
