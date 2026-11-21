export type VideoSource = 'drive' | 'youtube' | 'hls' | 'direct-video' | 'direct-audio';

export interface VideoInfo {
  source: VideoSource;
  id: string;
  embedUrl: string;
  externalUrl: string;
  thumbnailUrl: string;
  compactThumbnailUrl: string;
  fallbackThumbnailUrl: string;
  /** Whether JS playback time reading and seeking are supported */
  supportsSeek: boolean;
}

const HLS_PATTERN = /\.m3u8(\?|#|$)/i;
const DIRECT_VIDEO_PATTERN = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const DIRECT_AUDIO_PATTERN = /\.(m4a|mp3|aac|flac|ogg|wav)(\?|#|$)/i;

/**
 * Parse a Google Drive, YouTube, HLS (.m3u8), or direct HTML5 video/audio URL into
 * clean embed/stream URLs and thumbnail metadata.
 */
export function getVideoInfo(videoUrl?: string, useNoCookie = false): VideoInfo | null {
  if (!videoUrl) return null;

  const trimmed = videoUrl.trim();
  if (!trimmed) return null;

  if (trimmed.includes('drive.google.com')) {
    const match =
      trimmed.match(/\/d\/([^/?#&]+)/) || trimmed.match(/[?&]id=([^&#]+)/);
    if (match && match[1]) {
      const id = match[1];
      return {
        source: 'drive',
        id,
        embedUrl: `https://drive.google.com/file/d/${id}/preview`,
        externalUrl: `https://drive.google.com/file/d/${id}/view`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
        compactThumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w480`,
        fallbackThumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w480`,
        supportsSeek: false,
      };
    }
  }

  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    const match =
      trimmed.match(/[?&]v=([^&#]+)/) ||
      trimmed.match(/youtu\.be\/([^/?#&]+)/) ||
      trimmed.match(/\/embed\/([^/?#&]+)/) ||
      trimmed.match(/\/live\/([^/?#&]+)/) ||
      trimmed.match(/\/shorts\/([^/?#&]+)/);

    if (match && match[1]) {
      const id = match[1];
      const host = useNoCookie ? 'www.youtube-nocookie.com' : 'www.youtube.com';
      return {
        source: 'youtube',
        id,
        embedUrl: `https://${host}/embed/${id}?rel=0&playsinline=1&modestbranding=1&enablejsapi=1`,
        externalUrl: `https://www.youtube.com/watch?v=${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        compactThumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        fallbackThumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        supportsSeek: true,
      };
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    if (HLS_PATTERN.test(trimmed)) {
      return {
        source: 'hls',
        id: trimmed,
        embedUrl: trimmed,
        externalUrl: trimmed,
        thumbnailUrl: '',
        compactThumbnailUrl: '',
        fallbackThumbnailUrl: '',
        supportsSeek: true,
      };
    }
    if (DIRECT_VIDEO_PATTERN.test(trimmed)) {
      return {
        source: 'direct-video',
        id: trimmed,
        embedUrl: trimmed,
        externalUrl: trimmed,
        thumbnailUrl: '',
        compactThumbnailUrl: '',
        fallbackThumbnailUrl: '',
        supportsSeek: true,
      };
    }
    if (DIRECT_AUDIO_PATTERN.test(trimmed)) {
      return {
        source: 'direct-audio',
        id: trimmed,
        embedUrl: trimmed,
        externalUrl: trimmed,
        thumbnailUrl: '',
        compactThumbnailUrl: '',
        fallbackThumbnailUrl: '',
        supportsSeek: true,
      };
    }
  }

  return null;
}

export function isDirectStreamUrl(url?: string): boolean {
  const info = getVideoInfo(url);
  return info !== null && (info.source === 'hls' || info.source === 'direct-video' || info.source === 'direct-audio');
}
