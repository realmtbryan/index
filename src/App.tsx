/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Play,
  Search,
  Calendar,
  MapPin,
  User,
  Video,
  X,
  Music,
  MonitorPlay,
  Home,
  ExternalLink,
  Share2,
  Check,
  ArrowUpDown,
  HardDrive,
  Youtube
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SHOWS } from './data/shows';
import { Show } from './types';

type VideoSource = 'drive' | 'youtube';
type SourceFilter = 'all' | 'drive' | 'youtube' | 'none';

interface VideoInfo {
  source: VideoSource;
  id: string;
  embedUrl: string;
  externalUrl: string;
  thumbnailUrl: string;
  fallbackThumbnailUrl?: string;
}

const PAGE_SIZE = 48;

function getVideoInfo(videoUrl?: string, useNoCookie = false): VideoInfo | null {
  if (!videoUrl) return null;

  if (videoUrl.includes('drive.google.com')) {
    const match =
      videoUrl.match(/\/d\/([^/?#]+)/) || videoUrl.match(/[?&]id=([^&#]+)/);
    if (match && match[1]) {
      const id = match[1];
      return {
        source: 'drive',
        id,
        embedUrl: `https://drive.google.com/file/d/${id}/preview`,
        externalUrl: `https://drive.google.com/file/d/${id}/view`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
      };
    }
  }

  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    const match =
      videoUrl.match(/[?&]v=([^&#]+)/) ||
      videoUrl.match(/youtu\.be\/([^/?#]+)/) ||
      videoUrl.match(/\/embed\/([^/?#]+)/) ||
      videoUrl.match(/\/live\/([^/?#]+)/);
    if (match && match[1]) {
      const id = match[1];
      const host = useNoCookie ? 'www.youtube-nocookie.com' : 'www.youtube.com';
      const originParam =
        typeof window !== 'undefined' && window.location?.origin
          ? `&origin=${encodeURIComponent(window.location.origin)}`
          : '';
      return {
        source: 'youtube',
        id,
        embedUrl: `https://${host}/embed/${id}?rel=0&playsinline=1&enablejsapi=1${originParam}`,
        externalUrl: `https://www.youtube.com/watch?v=${id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        fallbackThumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  return null;
}

function formatLocation(show: Show): string {
  return [show.city, show.state].filter(Boolean).join(', ');
}

function formatShowTitle(show: Show): string {
  const loc = formatLocation(show);
  return `${show.artist} ${show.date} ${show.venue}${loc ? `, ${loc}` : ''}`;
}

function SourceBadge({ source, compact = false }: { source: VideoSource | null; compact?: boolean }) {
  if (!source) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded bg-black/90 border border-white/15 text-gray-400 font-medium ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        }`}
      >
        No Video
      </span>
    );
  }

  if (source === 'youtube') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded bg-red-600/95 text-white font-semibold shadow-sm ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        }`}
      >
        <Youtube className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        YouTube
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-blue-600/95 text-white font-semibold shadow-sm ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <HardDrive className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      Google Drive
    </span>
  );
}

function ShowCover({
  show,
  compact = false,
}: {
  show: Show;
  compact?: boolean;
}) {
  const info = getVideoInfo(show.videoUrl);
  const [imgSrc, setImgSrc] = useState<string | null>(info?.thumbnailUrl ?? null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgSrc(info?.thumbnailUrl ?? null);
    setImgFailed(false);
  }, [show.id, info?.thumbnailUrl]);

  // Shows without Google Drive or YouTube get pure black cover art
  if (!info) {
    return (
      <div className="w-full h-full bg-black border border-white/10 relative flex items-center justify-center">
        <div className="absolute bottom-2 right-2">
          <SourceBadge source={null} compact={compact} />
        </div>
      </div>
    );
  }

  const handleImgError = () => {
    if (info.fallbackThumbnailUrl && imgSrc !== info.fallbackThumbnailUrl) {
      setImgSrc(info.fallbackThumbnailUrl);
    } else {
      setImgFailed(true);
    }
  };

  const handleImgLoad = (img: HTMLImageElement) => {
    // YouTube maxresdefault returns a 120x90 grey placeholder when unavailable
    if (
      info.source === 'youtube' &&
      info.fallbackThumbnailUrl &&
      imgSrc !== info.fallbackThumbnailUrl &&
      img.naturalWidth <= 120
    ) {
      setImgSrc(info.fallbackThumbnailUrl);
    }
  };

  return (
    <div className="w-full h-full bg-[#161616] relative overflow-hidden">
      {!imgFailed && imgSrc ? (
        <img
          src={imgSrc}
          alt={formatShowTitle(show)}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImgError}
          onLoad={(e) => handleImgLoad(e.currentTarget)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full bg-neutral-950 flex flex-col items-center justify-center text-gray-500 gap-1.5">
          <Play className={compact ? 'w-5 h-5' : 'w-8 h-8'} />
        </div>
      )}

      <div className="absolute inset-0 bg-black/15 group-hover:bg-black/0 transition-colors" />

      <div className="absolute bottom-2 right-2 z-10">
        <SourceBadge source={info.source} compact={compact} />
      </div>

      {!compact && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Play className="w-6 h-6 fill-white text-white translate-x-0.5" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [selectedShow, setSelectedShow] = useState<Show | null>(() => {
    try {
      const showParam = new URLSearchParams(window.location.search).get('show');
      if (showParam) {
        return SHOWS.find((s) => s.id === showParam) ?? null;
      }
    } catch {
      // Ignore URL parsing errors
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | 'All'>('All');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [useNoCookieEmbed, setUseNoCookieEmbed] = useState(false);
  const [forcePreviewEmbed, setForcePreviewEmbed] = useState(false);
  const [isInNestedFrame] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const playerOverlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedShow) {
        setSelectedShow(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShow]);

  useEffect(() => {
    setForcePreviewEmbed(false);
    if (selectedShow && playerOverlayRef.current) {
      playerOverlayRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
    try {
      const url = new URL(window.location.href);
      if (selectedShow) {
        url.searchParams.set('show', selectedShow.id);
      } else {
        url.searchParams.delete('show');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore history errors in restricted frames
    }
  }, [selectedShow?.id]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedYear, sourceFilter, sortOrder]);

  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(SHOWS.map((s) => s.year))).sort((a, b) => a - b);
    return ['All', ...uniqueYears] as Array<'All' | number>;
  }, []);

  const filteredShows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SHOWS.filter((show) => {
      const matchesSearch =
        !q ||
        show.venue.toLowerCase().includes(q) ||
        show.city.toLowerCase().includes(q) ||
        show.state.toLowerCase().includes(q) ||
        show.artist.toLowerCase().includes(q) ||
        show.date.toLowerCase().includes(q) ||
        (show.notes?.toLowerCase().includes(q) ?? false) ||
        (show.setlist?.toLowerCase().includes(q) ?? false);

      const matchesYear = selectedYear === 'All' || show.year === selectedYear;

      const info = getVideoInfo(show.videoUrl);
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'drive' && info?.source === 'drive') ||
        (sourceFilter === 'youtube' && info?.source === 'youtube') ||
        (sourceFilter === 'none' && !info);

      return matchesSearch && matchesYear && matchesSource;
    }).sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [searchQuery, selectedYear, sourceFilter, sortOrder]);

  const visibleShows = useMemo(
    () => filteredShows.slice(0, visibleCount),
    [filteredShows, visibleCount]
  );

  const resetToHome = () => {
    setSelectedShow(null);
    setSelectedYear('All');
    setSourceFilter('all');
    setSearchQuery('');
  };

  const getShowDeepLink = (showId: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('show', showId);
      return url.toString();
    } catch {
      return `?show=${encodeURIComponent(showId)}`;
    }
  };

  const handleShare = async (show: Show) => {
    const info = getVideoInfo(show.videoUrl);
    const shareText = `${formatShowTitle(show)}${info ? ` - ${info.externalUrl}` : ''}`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(show.id);
      setTimeout(() => setCopiedId((prev) => (prev === show.id ? null : prev)), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const selectedVideoInfo = selectedShow
    ? getVideoInfo(selectedShow.videoUrl, useNoCookieEmbed)
    : null;

  const upNextShows = useMemo(() => {
    if (!selectedShow) return [];
    const sameDate = filteredShows.filter(
      (s) => s.id !== selectedShow.id && s.date === selectedShow.date
    );
    const sameYear = filteredShows.filter(
      (s) => s.id !== selectedShow.id && s.date !== selectedShow.date && s.year === selectedShow.year
    );
    const others = filteredShows.filter(
      (s) => s.id !== selectedShow.id && s.year !== selectedShow.year
    );
    return [...sameDate, ...sameYear, ...others].slice(0, 24);
  }, [filteredShows, selectedShow]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={resetToHome}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <MonitorPlay className="w-7 h-7 text-red-600 fill-red-600" />
          <span className="text-xl font-bold tracking-tighter">StringsArchive</span>
        </button>

        <div className="flex-1 min-w-[200px] max-w-2xl order-3 md:order-2 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search shows, dates (YYYY-MM-DD), venues, cities..."
              className="w-full bg-[#121212] border border-white/10 rounded-full py-1.5 pl-10 pr-9 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 order-2 md:order-3">
          <span className="text-xs text-gray-400 hidden sm:inline">
            {filteredShows.length} {filteredShows.length === 1 ? 'show' : 'shows'}
          </span>
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-medium transition-colors"
            title="Toggle chronological sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-3 border-r border-white/5 flex-shrink-0">
          <nav className="space-y-1">
            <SidebarItem
              icon={Home}
              label="All Shows"
              active={selectedYear === 'All' && sourceFilter === 'all'}
              onClick={resetToHome}
            />
            <hr className="my-3 border-white/10" />
            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Source
            </h3>
            <SidebarItem
              icon={Video}
              label="All Sources"
              active={sourceFilter === 'all'}
              onClick={() => setSourceFilter('all')}
            />
            <SidebarItem
              icon={HardDrive}
              label="Google Drive"
              active={sourceFilter === 'drive'}
              onClick={() => setSourceFilter('drive')}
            />
            <SidebarItem
              icon={Youtube}
              label="YouTube"
              active={sourceFilter === 'youtube'}
              onClick={() => setSourceFilter('youtube')}
            />
            <SidebarItem
              icon={Music}
              label="No Video (Black)"
              active={sourceFilter === 'none'}
              onClick={() => setSourceFilter('none')}
            />
            <hr className="my-3 border-white/10" />
            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Years
            </h3>
            {years.map((year) => (
              <div key={year}>
                <SidebarItem
                  icon={Calendar}
                  label={year.toString()}
                  active={selectedYear === year}
                  onClick={() => setSelectedYear(year)}
                />
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 min-w-0">
          {/* Year & Source Chips (Mobile/Tablet) */}
          <div className="space-y-2 pb-4 lg:hidden">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedYear === year
                      ? 'bg-white text-black'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {(
                [
                  ['all', 'All Sources'],
                  ['drive', 'Google Drive'],
                  ['youtube', 'YouTube'],
                  ['none', 'No Video'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSourceFilter(val)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    sourceFilter === val
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/15'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 mt-2">
            {visibleShows.map((show) => (
              <div
                key={show.id}
                className="group cursor-pointer"
                onClick={() => setSelectedShow(show)}
              >
                <div className="aspect-video rounded-xl overflow-hidden relative mb-3">
                  <ShowCover show={show} />
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-white/10">
                      <Music className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-semibold line-clamp-2 text-[0.95rem] leading-tight mb-1 group-hover:text-blue-400 transition-colors">
                      {formatShowTitle(show)}
                    </h3>
                    <div className="text-xs text-gray-400 space-y-0.5">
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{formatLocation(show)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>{show.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {visibleCount < filteredShows.length && (
            <div className="flex flex-wrap items-center justify-center gap-3 py-10">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
              >
                Load More ({filteredShows.length - visibleCount} remaining)
              </button>
              <button
                type="button"
                onClick={() => setVisibleCount(filteredShows.length)}
                className="px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/15 text-sm text-gray-300 transition-colors"
              >
                Show All ({filteredShows.length})
              </button>
            </div>
          )}

          {filteredShows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search className="w-12 h-12 mb-4 opacity-40" />
              <p className="text-lg">No shows found matching your filters.</p>
              <button
                type="button"
                onClick={resetToHome}
                className="mt-4 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm text-white transition-colors"
              >
                Reset filters
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Video Player Overlay */}
      <AnimatePresence>
        {selectedShow && (
          <motion.div
            ref={playerOverlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0f0f0f] overflow-y-auto"
          >
            <div className="max-w-[1700px] mx-auto min-h-screen flex flex-col xl:flex-row p-0 md:p-6 gap-6">
              {/* Header Mobile Only */}
              <div className="flex xl:hidden sticky top-0 bg-[#0f0f0f]/90 backdrop-blur-md z-10 p-4 border-b border-white/10 items-center justify-between">
                <span className="font-bold truncate max-w-[75%]">{selectedShow.venue}</span>
                <button
                  type="button"
                  onClick={() => setSelectedShow(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  aria-label="Close player"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Main Player Area */}
              <div className="flex-1 space-y-3">
                {selectedVideoInfo?.source === 'youtube' && (!isInNestedFrame || forcePreviewEmbed) && (
                  <div className="mx-3 md:mx-0 mt-2 md:mt-0 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-gray-300">
                      {isInNestedFrame
                        ? 'Embedded preview frames block YouTube login cookies. Open in a full tab or directly on YouTube if blocked.'
                        : 'Playback issue? Switch embed mode or open directly on YouTube.'}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {isInNestedFrame && (
                        <button
                          type="button"
                          onClick={() => setForcePreviewEmbed(false)}
                          className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 font-medium transition-colors"
                        >
                          Back to Poster
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setUseNoCookieEmbed((prev) => !prev)}
                        className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 font-medium transition-colors"
                      >
                        {useNoCookieEmbed ? 'Standard Embed' : 'Privacy Embed'}
                      </button>
                      {isInNestedFrame && (
                        <a
                          href={getShowDeepLink(selectedShow.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open App in New Tab
                        </a>
                      )}
                      <a
                        href={selectedVideoInfo.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Youtube className="w-3.5 h-3.5" />
                        Watch on YouTube
                      </a>
                    </div>
                  </div>
                )}

                <div className="aspect-video bg-black w-full rounded-none md:rounded-xl overflow-hidden relative shadow-2xl border border-white/10">
                  {selectedVideoInfo ? (
                    selectedVideoInfo.source === 'youtube' && isInNestedFrame && !forcePreviewEmbed ? (
                      <YouTubePreviewFallback
                        show={selectedShow}
                        videoInfo={selectedVideoInfo}
                        deepLinkUrl={getShowDeepLink(selectedShow.id)}
                        onTryInlineEmbed={() => setForcePreviewEmbed(true)}
                      />
                    ) : (
                      <iframe
                        key={`${selectedShow.id}-${selectedVideoInfo.embedUrl}`}
                        src={selectedVideoInfo.embedUrl}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        title={`${selectedShow.artist} ${selectedShow.date} ${selectedShow.venue}`}
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-center px-6">
                      <Video className="w-14 h-14 mb-3 text-gray-700" />
                      <p className="text-lg font-medium text-gray-300">
                        No Google Drive or YouTube video available
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedShow.date} — {selectedShow.venue} ({formatLocation(selectedShow)})
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-4 md:px-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <SourceBadge source={selectedVideoInfo?.source ?? null} />
                    {selectedShow.sourceType === 'recap' && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium">
                        Recap
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{selectedShow.date}</span>
                  </div>

                  <h1 className="text-xl md:text-2xl font-bold mb-4">
                    {formatShowTitle(selectedShow)}
                  </h1>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-white/10 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center font-bold text-sm">
                        BS
                      </div>
                      <div>
                        <div className="font-bold">{selectedShow.artist}</div>
                        <div className="text-xs text-gray-400">
                          {selectedShow.venue} • {formatLocation(selectedShow)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedVideoInfo && (
                        <a
                          href={selectedVideoInfo.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full flex items-center gap-2 text-sm font-medium transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open on {selectedVideoInfo.source === 'youtube' ? 'YouTube' : 'Google Drive'}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleShare(selectedShow)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full flex items-center gap-2 text-sm font-medium transition-colors"
                      >
                        {copiedId === selectedShow.id ? (
                          <>
                            <Check className="w-4 h-4 text-green-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4" />
                            Share
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 mt-5">
                    <div className="flex flex-wrap gap-4 text-sm font-semibold mb-2">
                      <span>{selectedShow.date}</span>
                      <span className="text-blue-400 flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> {formatLocation(selectedShow)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                      {selectedShow.bandMembers && (
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4" /> Lineup: {selectedShow.bandMembers}
                        </div>
                      )}
                      {selectedShow.notes && (
                        <p className="text-gray-300 mb-2">{selectedShow.notes}</p>
                      )}
                      <p className="leading-relaxed text-gray-400">
                        Archive entry for {selectedShow.artist} performing at {selectedShow.venue}{' '}
                        on {selectedShow.date} ({selectedShow.year} tour).
                      </p>

                      {selectedShow.setlist && (
                        <div className="mt-6">
                          <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-white">
                            <Music className="w-5 h-5 text-gray-400" /> Setlist
                          </h3>
                          <div className="p-4 bg-black/40 rounded-lg border border-white/5 text-gray-300 leading-relaxed">
                            {selectedShow.setlist}
                          </div>
                        </div>
                      )}

                      {selectedShow.reviews && (
                        <div className="mt-6">
                          <h3 className="font-bold text-lg mb-2 text-white">Fan Reviews</h3>
                          <div className="space-y-3">
                            {selectedShow.reviews.split(' // ').map((review, i) => (
                              <div
                                key={i}
                                className="p-4 bg-black/40 rounded-lg border border-white/5 text-sm text-gray-400 italic"
                              >
                                "{review}"
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Next Videos */}
              <div className="w-full xl:w-[400px] px-4 md:px-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold">More shows</h2>
                  <button
                    type="button"
                    onClick={() => setSelectedShow(null)}
                    className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-xs font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Close
                  </button>
                </div>
                <div className="space-y-3 pb-20">
                  {upNextShows.map((show) => (
                    <div
                      key={show.id}
                      className="flex gap-2.5 group cursor-pointer"
                      onClick={() => setSelectedShow(show)}
                    >
                      <div className="w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0">
                        <ShowCover show={show} compact />
                      </div>
                      <div className="overflow-hidden flex-1">
                        <h4 className="text-sm font-semibold line-clamp-2 leading-tight mb-1 group-hover:text-blue-400 transition-colors">
                          {formatShowTitle(show)}
                        </h4>
                        <p className="text-xs text-gray-400 truncate">{show.venue}</p>
                        <p className="text-xs text-gray-500">{show.date}</p>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedShow(null)}
                    className="w-full py-3 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors hidden xl:block"
                  >
                    Back to Archive
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function YouTubePreviewFallback({
  show,
  videoInfo,
  deepLinkUrl,
  onTryInlineEmbed,
}: {
  show: Show;
  videoInfo: VideoInfo;
  deepLinkUrl: string;
  onTryInlineEmbed: () => void;
}) {
  const [posterSrc, setPosterSrc] = useState(videoInfo.thumbnailUrl);

  useEffect(() => {
    setPosterSrc(videoInfo.thumbnailUrl);
  }, [show.id, videoInfo.thumbnailUrl]);

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
      <img
        src={posterSrc}
        alt={formatShowTitle(show)}
        referrerPolicy="no-referrer"
        onError={() => {
          if (videoInfo.fallbackThumbnailUrl && posterSrc !== videoInfo.fallbackThumbnailUrl) {
            setPosterSrc(videoInfo.fallbackThumbnailUrl);
          }
        }}
        onLoad={(e) => {
          if (
            videoInfo.fallbackThumbnailUrl &&
            posterSrc !== videoInfo.fallbackThumbnailUrl &&
            e.currentTarget.naturalWidth <= 120
          ) {
            setPosterSrc(videoInfo.fallbackThumbnailUrl);
          }
        }}
        className="w-full h-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/40" />
      <div className="relative z-10 max-w-lg px-6 text-center flex flex-col items-center">
        <a
          href={videoInfo.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-xl transition-transform hover:scale-105"
          aria-label="Watch on YouTube"
        >
          <Play className="w-7 h-7 fill-white text-white translate-x-0.5" />
        </a>
        <h2 className="text-base md:text-lg font-bold text-white mb-1.5">
          {formatShowTitle(show)}
        </h2>
        <p className="text-xs md:text-sm text-gray-300 mb-5 leading-relaxed">
          Preview mode runs inside a nested frame where browsers isolate YouTube login cookies
          (causing YouTube&apos;s bot check). Watch directly on YouTube or open this show in a full
          browser tab to play inline.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <a
            href={videoInfo.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs md:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Youtube className="w-4 h-4" />
            Watch on YouTube
          </a>
          <a
            href={deepLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs md:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Show in New Tab
          </a>
          <button
            type="button"
            onClick={onTryInlineEmbed}
            className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-gray-100 text-xs md:text-sm font-medium transition-colors"
          >
            Try Inline Embed
          </button>
        </div>
      </div>
    </div>
  );
}

interface SidebarItemProps {
  icon: typeof Home;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, active = false, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-3 py-2 rounded-lg transition-colors group text-left ${
        active ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'
      }`}
    >
      <Icon
        className={`w-4 h-4 flex-shrink-0 ${
          active ? 'text-white' : 'text-gray-400 group-hover:text-white'
        }`}
      />
      <span className={`text-sm truncate ${active ? 'font-semibold' : 'font-medium'}`}>
        {label}
      </span>
    </button>
  );
}
