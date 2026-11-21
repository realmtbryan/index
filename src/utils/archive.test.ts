import test from 'node:test';
import assert from 'node:assert/strict';
import { getVideoInfo, isDirectStreamUrl } from './video';
import {
  buildSongIndex,
  computeArchiveStats,
  countHiddenArchiveMatches,
  filterAndSortGroupedShows,
  filterAndSortShows,
  findSimilarShows,
  getBaseVenueName,
  getSameShowParts,
  getUpNextGroups,
  getUpNextShows,
  groupShowsByPerformance,
  isRecapOrPromo,
  parseSetlist,
  pickRandomPlayableGroup,
  pickRandomPlayableShow,
} from './shows';
import {
  buildShowChapters,
  formatTimestamp,
  getActiveChapterIndex,
  getChaptersForShow,
  parseCustomTimingsInput,
} from './chapters';
import { detectDeviceProfile, parseModeFromQuery } from './device';
import {
  loadAutoAdvanceParts,
  loadCustomStreams,
  loadCustomTimings,
  loadLayoutMode,
  loadRecentIds,
  loadSavedIds,
  loadSyncOffsets,
  persistAutoAdvanceParts,
  persistCustomStream,
  persistCustomTiming,
  persistLayoutMode,
  persistRecentIds,
  persistSavedIds,
  persistSyncOffset,
  recordRecentId,
  toggleSavedId,
} from './storage';
import { SHOWS } from '../data/shows';
import { Show } from '../types';

const SAMPLE_SHOWS: Show[] = [
  {
    id: '2018-12-19-827',
    artist: 'Billy Strings',
    date: '2018-12-19',
    venue: 'Wonder Bar',
    city: 'Asbury Park',
    state: 'NJ',
    year: 2018,
    videoUrl: 'https://www.youtube.com/embed/2ZoMfVHbWNs',
    setlist: 'Dust In A Baggie | Pyramid Country | Meet Me at the Creek',
    sourceType: 'youtube',
  },
  {
    id: '2018-12-19-827-part-1',
    artist: 'Billy Strings',
    date: '2018-12-19',
    venue: 'Wonder Bar (Part 2)',
    city: 'Asbury Park',
    state: 'NJ',
    year: 2018,
    videoUrl: 'https://www.youtube.com/embed/7RDncgv6B_E',
    sourceType: 'youtube',
  },
  {
    id: '2018-12-15-823',
    artist: 'Billy Strings',
    date: '2018-12-15',
    venue: 'World Cafe Live',
    city: 'Philadelphia',
    state: 'PA',
    year: 2018,
    videoUrl: 'https://drive.google.com/file/d/1kUbx7K_35LC4TP1o_N53REeR4YbkTNtH/preview',
    setlist: 'Dust In A Baggie | Turmoil & Tinfoil | Meet Me at the Creek',
    sourceType: 'drive',
  },
  {
    id: '2018-12-15-823-part-1',
    artist: 'Billy Strings',
    date: '2018-12-15',
    venue: 'World Cafe Live (Part 2)',
    city: 'Philadelphia',
    state: 'PA',
    year: 2018,
    videoUrl: 'https://www.youtube.com/embed/UrLGGtnfl5U',
    sourceType: 'youtube',
  },
  {
    id: '2018-06-28-736',
    artist: 'Billy Strings',
    date: '2018-06-28',
    venue: 'Ryman Auditorium (Recap)',
    city: 'Nashville',
    state: 'TN',
    year: 2018,
    videoUrl: 'https://www.youtube.com/watch?v=kKYLR5Aa5HI',
    setlist: 'Intro | Dust In A Baggie | Pyramid Country',
    sourceType: 'recap',
  },
  {
    id: '2019-02-14-none',
    artist: 'Billy Strings',
    date: '2019-02-14',
    venue: 'Ryman Auditorium',
    city: 'Nashville',
    state: 'TN',
    year: 2019,
    setlist: 'Turmoil & Tinfoil | Highway Hypnosis | Dust In A Baggie',
  },
  {
    id: '2017-12-30-656',
    artist: 'Billy Strings',
    date: '2017-12-30',
    venue: 'Riviera Theatre',
    city: 'Chicago',
    state: 'IL',
    year: 2017,
    videoUrl: 'https://youtu.be/VK20FD-402M',
    setlist: 'On The Southbound | Red Fox | Dust In A Baggie | Pyramid Country',
    sourceType: 'youtube',
  },
];

test('device auto-detection classifies TV, Mobile, and Desktop accurately', () => {
  assert.equal(
    detectDeviceProfile({
      width: 1920,
      height: 1080,
      coarsePointer: false,
      canHover: true,
      userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36',
    }),
    'tv'
  );
  assert.equal(
    detectDeviceProfile({
      width: 390,
      height: 844,
      coarsePointer: true,
      canHover: false,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    }),
    'mobile'
  );
  assert.equal(
    detectDeviceProfile({
      width: 1440,
      height: 900,
      coarsePointer: false,
      canHover: true,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.0.0',
    }),
    'desktop'
  );
  assert.equal(parseModeFromQuery('?mode=tv'), 'tv');
  assert.equal(parseModeFromQuery('?mode=invalid'), null);
});

test('getVideoInfo parses YouTube, Google Drive, HLS (.m3u8), and direct video/audio URLs', () => {
  const ytWatch = getVideoInfo('https://www.youtube.com/watch?v=kKYLR5Aa5HI');
  assert.equal(ytWatch?.source, 'youtube');
  assert.equal(ytWatch?.id, 'kKYLR5Aa5HI');
  assert.equal(ytWatch?.supportsSeek, true);
  assert.ok(ytWatch?.embedUrl.includes('enablejsapi=1'));

  const drive = getVideoInfo(
    'https://drive.google.com/file/d/1YK0r7P5eNNGeYZKDtDcfj9TiDA-iGzXm/preview'
  );
  assert.equal(drive?.source, 'drive');
  assert.equal(drive?.supportsSeek, false);

  const hls = getVideoInfo(
    'https://example.akamaized.net/nas5/bstr/260829.hls/bstr260829_hls_4200.m3u8?token=abc'
  );
  assert.equal(hls?.source, 'hls');
  assert.equal(hls?.supportsSeek, true);
  assert.equal(isDirectStreamUrl(hls?.embedUrl), true);

  const m4a = getVideoInfo('https://example.com/show/track01.m4a?sig=1');
  assert.equal(m4a?.source, 'direct-audio');
  assert.equal(m4a?.supportsSeek, true);

  assert.equal(getVideoInfo(undefined), null);
});

test('global recap hiding & multi-part grouping collapse split shows cleanly on real catalog', () => {
  const groups = groupShowsByPerformance(SHOWS, false);
  // Zero recaps anywhere in grouped catalog
  assert.equal(
    groups.some((g) => g.parts.some((p) => isRecapOrPromo(p))),
    false
  );

  // 2018-12-19 Wonder Bar collapses 8 parts into 1 unified show group
  const wonderBar = groups.filter(
    (g) => g.primaryShow.date === '2018-12-19' && g.displayVenue === 'Wonder Bar'
  );
  assert.equal(wonderBar.length, 1);
  assert.equal(wonderBar[0].parts.length, 8);
  assert.equal(wonderBar[0].playablePartCount, 8);

  // 2018-12-15 World Cafe Live collapses 11 parts into 1 unified show group
  const worldCafe = groups.filter(
    (g) => g.primaryShow.date === '2018-12-15' && g.displayVenue === 'World Cafe Live'
  );
  assert.equal(worldCafe.length, 1);
  assert.equal(worldCafe[0].parts.length, 11);

  // 2023-04-14 Mobile recap is hidden while full Drive show remains
  const mobile = groups.filter((g) => g.primaryShow.date === '2023-04-14');
  assert.equal(mobile.length, 1);
  assert.equal(mobile[0].parts.length, 1);
  assert.equal(mobile[0].primaryShow.sourceType, 'drive');

  // Short tour recaps (2025 1-3m clips) and Nugs Subscriber Livestream previews (2026) are hidden globally
  assert.equal(
    groups.some((g) => g.primaryShow.id === '2026-10-31-extra'),
    false
  );
  assert.equal(
    groups.some((g) => g.primaryShow.id === '2026-04-02-1489'),
    false
  );
  assert.equal(
    groups.some((g) => g.primaryShow.id === '2025-09-14-1452'),
    false
  );
  assert.equal(
    groups.some((g) => g.primaryShow.id === '2025-08-12-1441'),
    false
  );
  // Genuine full-length 2025/2026 concerts remain playable
  assert.equal(
    groups.some((g) => g.primaryShow.id === '2026-04-18-1497'),
    true
  );
  assert.equal(
    groups.some((g) => g.primaryShow.id === '2025-10-31-1466'),
    true
  );
});

test('Up Next strictly excludes archive-only records, recaps, and orders chronologically/similarly', () => {
  const groups = groupShowsByPerformance(SAMPLE_SHOWS, false);
  const target = groups.find((g) => g.primaryShow.id === '2018-12-19-827')!;
  const upNext = getUpNextGroups(groups, groups, target.primaryShow, 10);

  // Archive-only Ryman 2019-02-14 and recap Ryman 2018-06-28 must NOT appear
  assert.equal(
    upNext.some((g) => !g.hasPlayableVideo),
    false
  );
  assert.equal(
    upNext.some((g) => isRecapOrPromo(g.primaryShow)),
    false
  );
  // Same-year neighbor (World Cafe Live 2018-12-15) comes before 2017 Riviera Theatre
  assert.equal(upNext[0].primaryShow.date, '2018-12-15');
  assert.equal(upNext[1].primaryShow.date, '2017-12-30');

  const flatUpNext = getUpNextShows(SAMPLE_SHOWS, SAMPLE_SHOWS, SAMPLE_SHOWS[0], 10);
  assert.ok(flatUpNext.every((s) => getVideoInfo(s.videoUrl) !== null));
});

test('Nugs-synced chapters compute exact timestamps for 2023-03-07 Georgia Theatre and support Sync Offset', () => {
  const georgia = SHOWS.find((s) => s.date === '2023-03-07' && s.venue === 'Georgia Theatre');
  assert.ok(georgia, 'Expected 2023-03-07 Georgia Theatre in SHOWS');

  const { chapters, isExact } = getChaptersForShow(georgia, 0);
  assert.equal(isExact, true);
  assert.equal(chapters.length, 33);

  // Tracks 1-6 sum to 66 + 194 + 404 + 233 + 328 + 292 = 1517s = 25:17
  const heartbeat = chapters[6];
  assert.equal(heartbeat.title, 'Heartbeat Of America');
  assert.equal(heartbeat.startTime, 1517);
  assert.equal(formatTimestamp(heartbeat.startTime), '25:17');

  // With +2s sync offset -> 25:19 matching Drive video start
  const nudged = getChaptersForShow(georgia, 2).chapters;
  assert.equal(nudged[6].startTime, 1519);
  assert.equal(formatTimestamp(nudged[6].startTime), '25:19');

  // Negative offset clamps at 0 for opening track
  const neg = buildShowChapters(['Tuning', 'Song 2'], [66, 180], -100);
  assert.equal(neg[0].startTime, 0);
  assert.equal(neg[1].startTime, 0);

  // Active chapter detection
  assert.equal(getActiveChapterIndex(chapters, 0), 0);
  assert.equal(getActiveChapterIndex(chapters, 1516), 5);
  assert.equal(getActiveChapterIndex(chapters, 1517), 6);
  assert.equal(getActiveChapterIndex(chapters, 2000), 6);
});

test('parseCustomTimingsInput parses both Nugs show JSON and plain mm:ss track lines', () => {
  const fromJson = parseCustomTimingsInput(
    JSON.stringify({
      Response: {
        containerID: 32331,
        tracks: [
          { songTitle: 'Tuning', totalRunningTime: 45, setNum: 1 },
          { songTitle: 'Slow Train', totalRunningTime: 220, setNum: 1 },
          { songTitle: 'Encore Song', totalRunningTime: 300, setNum: 4 },
        ],
      },
    })
  );
  assert.deepEqual(fromJson?.durations, [45, 220, 300]);
  assert.deepEqual(fromJson?.sets, [1, 1, 4]);
  assert.equal(fromJson?.sourceLabel, 'Nugs #32331');

  const fromText = parseCustomTimingsInput('01:06\nEverything 03:14\n06:44');
  assert.deepEqual(fromText?.durations, [66, 194, 404]);
});

test('multi-song finder and Similar Setlists rank playable shows accurately', () => {
  const groups = groupShowsByPerformance(SAMPLE_SHOWS, false);
  const songIndex = buildSongIndex(groups);
  assert.ok(songIndex.some((s) => s.title === 'Dust In A Baggie' && s.playableShows === 3));

  // Multi-song AND filter: Dust In A Baggie + Pyramid Country
  const dualMatch = filterAndSortGroupedShows(groups, {
    searchQuery: '',
    selectedYear: 'All',
    collection: 'video',
    sortOrder: 'desc',
    savedIds: new Set(),
    recentIds: [],
    selectedSongs: ['Dust In A Baggie', 'Pyramid Country'],
  });
  assert.deepEqual(
    dualMatch.map((g) => g.primaryShow.date),
    ['2018-12-19', '2017-12-30']
  );

  // Similar setlists for Wonder Bar (Dust + Pyramid + Creek)
  const target = groups.find((g) => g.primaryShow.date === '2018-12-19')!;
  const similar = findSimilarShows(groups, target.primaryShow, 5);
  assert.equal(similar.length, 2); // Both World Cafe Live (2 overlap) and Riviera (2 overlap); archive-only Ryman excluded
  assert.ok(similar.every((m) => m.group.hasPlayableVideo));
  assert.equal(similar[0].overlapCount, 2);
});

test('filterAndSortShows, stats, hidden archive count, random show, and storage helpers work cleanly', () => {
  assert.equal(getBaseVenueName('Poppycocks (Part 2)'), 'Poppycocks');
  assert.deepEqual(parseSetlist('Dust In A Baggie | Pyramid Country |  '), [
    'Dust In A Baggie',
    'Pyramid Country',
  ]);
  assert.equal(getSameShowParts(SAMPLE_SHOWS, SAMPLE_SHOWS[0]).length, 2);

  const stats = computeArchiveStats(SAMPLE_SHOWS);
  assert.equal(stats.hiddenRecapCount, 1);
  assert.equal(stats.total, 4); // 4 distinct non-recap performances
  assert.equal(stats.videoCount, 3);
  assert.equal(stats.noVideoCount, 1);

  const hidden = countHiddenArchiveMatches(SAMPLE_SHOWS, 'Ryman', 'All', 'video');
  assert.equal(hidden, 1);

  const videos = filterAndSortShows(SAMPLE_SHOWS, {
    searchQuery: '',
    selectedYear: 'All',
    collection: 'video',
    sortOrder: 'desc',
    savedIds: new Set(),
    recentIds: [],
  });
  assert.equal(videos.length, 3);

  const picked = pickRandomPlayableShow(SAMPLE_SHOWS, SAMPLE_SHOWS, '2018-12-19-827', () => 0.5);
  assert.ok(picked);
  assert.notEqual(picked.id, '2018-12-19-827');
  assert.equal(isRecapOrPromo(picked), false);

  const pickedGroup = pickRandomPlayableGroup(
    groupShowsByPerformance(SAMPLE_SHOWS, false),
    groupShowsByPerformance(SAMPLE_SHOWS, false),
    undefined,
    () => 0.2
  );
  assert.ok(pickedGroup?.hasPlayableVideo);

  // Storage round-trip tests
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  let saved = toggleSavedId([], 'show-1');
  saved = toggleSavedId(saved, 'show-2');
  persistSavedIds(saved, mockStorage);
  assert.deepEqual(loadSavedIds(mockStorage), ['show-2', 'show-1']);

  let recent = recordRecentId([], 'a');
  recent = recordRecentId(recent, 'b');
  recent = recordRecentId(recent, 'a');
  persistRecentIds(recent, mockStorage);
  assert.deepEqual(loadRecentIds(mockStorage), ['a', 'b']);

  persistLayoutMode('tv', mockStorage);
  assert.equal(loadLayoutMode(mockStorage), 'tv');

  persistSyncOffset('2023-03-07-1258', 2, mockStorage);
  assert.equal(loadSyncOffsets(mockStorage)['2023-03-07-1258'], 2);

  persistCustomStream('2023-03-07-1258', 'https://example.com/live.m3u8', mockStorage);
  assert.equal(loadCustomStreams(mockStorage)['2023-03-07-1258'], 'https://example.com/live.m3u8');

  persistCustomTiming('2023-03-07-1258', { durations: [66, 194] }, mockStorage);
  assert.deepEqual(loadCustomTimings(mockStorage)['2023-03-07-1258']?.durations, [66, 194]);

  persistAutoAdvanceParts(false, mockStorage);
  assert.equal(loadAutoAdvanceParts(mockStorage), false);
});
