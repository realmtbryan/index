import { Bookmark } from 'lucide-react';
import { GroupedShow, Show } from '../types';
import { formatLocation, parseSetlist } from '../utils/shows';
import { ShowThumbnail } from './ShowThumbnail';

interface ShowCardProps {
  group: GroupedShow;
  isSaved: boolean;
  onSelect: (show: Show) => void;
  onToggleSave: (showId: string) => void;
  large?: boolean;
}

export function ShowCard({
  group,
  isSaved,
  onSelect,
  onToggleSave,
  large = false,
}: ShowCardProps) {
  const show = group.primaryShow;
  const location = formatLocation(show);
  const songCount = parseSetlist(show.setlist).length;

  return (
    <article className="group flex flex-col">
      <button
        type="button"
        onClick={() => onSelect(show)}
        aria-label={`Open ${group.displayVenue} on ${show.date}`}
        className="aspect-video w-full rounded-xl overflow-hidden bg-[#131316] border border-white/[0.08] group-hover:border-white/25 transition-colors mb-3 block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
      >
        <ShowThumbnail
          show={show}
          partCount={group.playablePartCount > 1 ? group.playablePartCount : group.parts.length}
          hasChapters={group.hasChapters}
        />
      </button>

      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelect(show)}
          aria-label={`Watch ${group.displayVenue} (${show.date})`}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-zinc-400 mb-1">
            <span className="shrink-0">{show.date}</span>
            {location && (
              <>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span className="font-sans truncate">{location}</span>
              </>
            )}
          </div>

          <h3
            className={`${
              large ? 'text-base' : 'text-[15px]'
            } font-semibold text-[#f4f4f0] leading-snug line-clamp-2 group-hover:text-amber-300 transition-colors`}
          >
            {group.displayVenue}
          </h3>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500 mt-1">
            <span className="truncate max-w-[160px]">{show.artist}</span>
            {songCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{songCount} songs</span>
              </>
            )}
            {group.parts.length > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-amber-300/90">
                  {group.parts.length} parts
                </span>
              </>
            )}
            {!group.hasPlayableVideo && (
              <>
                <span aria-hidden="true">·</span>
                <span>No video</span>
              </>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onToggleSave(show.id)}
          aria-label={
            isSaved
              ? `Remove ${group.displayVenue} (${show.date}) from saved shows`
              : `Save ${group.displayVenue} (${show.date})`
          }
          aria-pressed={isSaved}
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
            isSaved
              ? 'text-amber-400 hover:bg-amber-400/10'
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]'
          }`}
        >
          <Bookmark
            className={`w-4 h-4 ${isSaved ? 'fill-amber-400' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </article>
  );
}
