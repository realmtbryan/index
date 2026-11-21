export type LayoutMode = 'tv' | 'desktop' | 'mobile';

export interface Show {
  id: string;
  artist: string;
  date: string;
  venue: string;
  city: string;
  state: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  notes?: string;
  bandMembers?: string;
  setlist?: string;
  reviews?: string;
  year: number;
  sourceType?: 'drive' | 'youtube' | 'recap' | 'direct';
  /** Optional per-song track durations in seconds (aligned 1:1 with parsed setlist) */
  trackDurations?: number[];
  /** Optional per-song set markers (1 = Set 1, 2 = Set 2, 3 = Set 3, 4 = Encore) */
  trackSets?: number[];
  /** Optional Nugs catalog release ID for deep-linking or artwork */
  nugsShowId?: string;
  /** Optional official show artwork URL */
  nugsArtworkUrl?: string;
  /** Optional direct HLS (.m3u8) or MP4/M4A stream URL */
  directStreamUrl?: string;
}

export interface GroupedShow {
  /** Stable key based on date + normalized base venue */
  groupKey: string;
  /** Canonical representative show (Part 1 or first playable part, enriched with merged setlist/notes) */
  primaryShow: Show;
  /** Clean venue name with trailing "(Part N)" removed */
  displayVenue: string;
  /** All non-recap parts belonging to this performance, sorted Part 1..N */
  parts: Show[];
  /** Number of playable video parts in this performance */
  playablePartCount: number;
  /** Whether any part is playable */
  hasPlayableVideo: boolean;
  hasYouTube: boolean;
  hasDrive: boolean;
  /** Whether verified or custom track chapter timings exist for this performance */
  hasChapters: boolean;
}

export interface Chapter {
  index: number;
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  setNumber?: number;
  /** True when timestamps come from verified/user track durations rather than estimated */
  isExact: boolean;
}

export interface SimilarShowMatch {
  group: GroupedShow;
  overlapCount: number;
  matchingSongs: string[];
  similarityScore: number;
}

export interface NugsShowMetadata {
  date: string;
  nugsShowId: string;
  artworkUrl?: string;
  totalDurationSeconds?: number;
  trackDurations?: number[];
  trackSets?: number[];
  trackTitles?: string[];
  hasVideoOnDemand?: boolean;
}

export interface CustomShowTiming {
  durations: number[];
  sets?: number[];
  sourceLabel?: string;
}

export interface YearGroup {
  year: number;
  shows: Show[];
}
