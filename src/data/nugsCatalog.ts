import { NugsShowMetadata } from '../types';

/**
 * Verified public Nugs catalog metadata (release IDs, artwork URLs, and track durations)
 * for Billy Strings (artist ID 1125, abbreviation "bstr").
 * Contains zero credentials, tokens, or account information.
 */
export const NUGS_CATALOG_BY_DATE: Record<string, NugsShowMetadata> = {
  '2023-03-07': {
    date: '2023-03-07',
    nugsShowId: '31782',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230307_02.jpg?w=600&h=600',
    totalDurationSeconds: 11353,
    // Verified 1:1 with 2023-03-07 Georgia Theatre 33-track setlist:
    // Tracks 1-6 sum to 1517s (25:17), matching 07 Heartbeat Of America starting at ~25:19 on Drive video
    trackDurations: [
      66, 194, 404, 233, 328, 292, 1012, 414, 239, 263, 446, 588, 242, 181,
      254, 168, 214, 211, 197, 132, 150, 742, 253, 342, 1168, 437, 223, 537, 197, 502,
      152, 192, 380,
    ],
    trackSets: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
      4, 4, 4,
    ],
    trackTitles: [
      'Tuning',
      "Everything's The Same",
      'Thirst Mutilator',
      'Taking Water',
      'On The Line',
      'Rock Salt And Nails',
      'Heartbeat Of America',
      'There Is A Time',
      'Slow Train',
      'John Deere Tractor',
      'West Dakota Rose',
      'Fire Line',
      'Ice Bridges',
      'Hollow Heart',
      'Church Street Blues',
      'Cocaine Blues',
      'Cold, Cold World',
      'Two Girls',
      'Lonely at the Top',
      'Beaumont Rag',
      'Black Mountain Rag',
      'Pretty Daughter',
      'Run Down',
      "While I'm Waiting Here",
      'Hide And Seek',
      'Fearless',
      "Bringin' In The Georgia Mail",
      'Running The Route',
      'Running',
      'All Time Low',
      "If Your Hair's Too Long (There's Sin In Your Heart)",
      'Standing In The Need Of Prayer',
      'Home Of The Red Fox 3000',
    ],
  },
  '2023-04-14': {
    date: '2023-04-14',
    nugsShowId: '32331',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230414_01.jpg?w=600&h=600',
  },
  '2023-03-10': {
    date: '2023-03-10',
    nugsShowId: '31783',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230310_02.jpg?w=600&h=600',
  },
  '2023-03-11': {
    date: '2023-03-11',
    nugsShowId: '31784',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230311_02.jpg?w=600&h=600',
  },
  '2023-03-12': {
    date: '2023-03-12',
    nugsShowId: '31785',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230312_02.jpg?w=600&h=600',
  },
  '2023-03-18': {
    date: '2023-03-18',
    nugsShowId: '31788',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230318_02.jpg?w=600&h=600',
  },
  '2023-03-03': {
    date: '2023-03-03',
    nugsShowId: '31780',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230303_02.jpg?w=600&h=600',
  },
  '2023-03-04': {
    date: '2023-03-04',
    nugsShowId: '31781',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230304_03.jpg?w=600&h=600',
  },
  '2023-02-04': {
    date: '2023-02-04',
    nugsShowId: '31413',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230204_02.jpg?w=600&h=600',
  },
  '2023-02-24': {
    date: '2023-02-24',
    nugsShowId: '31708',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230224_02.jpg?w=600&h=600',
  },
  '2023-04-20': {
    date: '2023-04-20',
    nugsShowId: '32334',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230420_01.jpg?w=600&h=600',
  },
  '2023-04-22': {
    date: '2023-04-22',
    nugsShowId: '32336',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230422_01.jpg?w=600&h=600',
  },
  '2023-05-13': {
    date: '2023-05-13',
    nugsShowId: '32614',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230513_02.jpg?w=600&h=600',
  },
  '2023-05-24': {
    date: '2023-05-24',
    nugsShowId: '32929',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230524_02.jpg?w=600&h=600',
  },
  '2023-06-10': {
    date: '2023-06-10',
    nugsShowId: '33011',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230610_02.jpg?w=600&h=600',
  },
  '2023-07-23': {
    date: '2023-07-23',
    nugsShowId: '33476',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230723_02.jpg?w=600&h=600',
  },
  '2023-07-26': {
    date: '2023-07-26',
    nugsShowId: '33478',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr230726_02.jpg?w=600&h=600',
  },
  '2023-11-11': {
    date: '2023-11-11',
    nugsShowId: '34394',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr231111_01.jpg?w=600&h=600',
  },
  '2023-12-31': {
    date: '2023-12-31',
    nugsShowId: '34410',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr231231_02.jpg?w=600&h=600',
  },
  '2024-02-18': {
    date: '2024-02-18',
    nugsShowId: '35977',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr240218_02.jpg?w=600&h=600',
  },
  '2024-05-11': {
    date: '2024-05-11',
    nugsShowId: '35991',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr240511_01.jpg?w=600&h=600',
  },
  '2022-07-27': {
    date: '2022-07-27',
    nugsShowId: '29629',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr220727_01.jpg?w=600&h=600',
  },
  '2021-04-11': {
    date: '2021-04-11',
    nugsShowId: '26351',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr210411_01.jpg?w=600&h=600',
  },
  '2021-09-24': {
    date: '2021-09-24',
    nugsShowId: '27410',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr210924_01.jpg?w=600&h=600',
  },
  '2020-04-04': {
    date: '2020-04-04',
    nugsShowId: '24659',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr200404_01.jpg?w=600&h=600',
  },
  '2020-09-26': {
    date: '2020-09-26',
    nugsShowId: '25370',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr200926_04.jpg?w=600&h=600',
  },
  '2018-11-09': {
    date: '2018-11-09',
    nugsShowId: '20672',
    artworkUrl: 'https://assets-01.nugscdn.net/livedownloads/images/shows/bstr181109_01.jpg?w=600&h=600',
  },
};

export function getNugsMetadataForDate(date: string): NugsShowMetadata | undefined {
  return NUGS_CATALOG_BY_DATE[date];
}

export function getNugsReleaseUrl(nugsShowId?: string, date?: string): string {
  if (nugsShowId) {
    return `https://play.nugs.net/release/${encodeURIComponent(nugsShowId)}`;
  }
  if (date) {
    return `https://play.nugs.net/search?q=${encodeURIComponent(`Billy Strings ${date}`)}`;
  }
  return 'https://play.nugs.net/browse/artist/1125';
}
