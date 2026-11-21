import { useEffect, useState } from 'react';
import { ArrowRight, Disc3, Monitor, Smartphone, Tv } from 'lucide-react';
import { LayoutMode } from '../types';
import { LAYOUT_MODE_LABELS } from '../utils/device';

interface DeviceLanderProps {
  detectedMode: LayoutMode;
  playableCount: number;
  onConfirm: (mode: LayoutMode) => void;
}

const MODE_OPTIONS: Array<{
  id: LayoutMode;
  title: string;
  subtitle: string;
  details: string;
  icon: typeof Monitor;
}> = [
  {
    id: 'tv',
    title: 'TV / Big Picture',
    subtitle: '10-foot lean-back interface',
    details: 'Oversized hero cards, high-contrast focus rings, full D-pad & Arrow-key navigation.',
    icon: Tv,
  },
  {
    id: 'desktop',
    title: 'Desktop Theater',
    subtitle: 'Dense theater & setlist workspace',
    details: 'Side-by-side concert player, chapter scrubber, setlist finder, and tour-year sidebar.',
    icon: Monitor,
  },
  {
    id: 'mobile',
    title: 'Mobile Touch',
    subtitle: 'Thumb-friendly compact layout',
    details: 'Bottom navigation, slide-up filters, and stacked player with scrollable setlist.',
    icon: Smartphone,
  },
];

export function DeviceLander({
  detectedMode,
  playableCount,
  onConfirm,
}: DeviceLanderProps) {
  const [selected, setSelected] = useState<LayoutMode>(detectedMode);

  useEffect(() => {
    const order: LayoutMode[] = ['tv', 'desktop', 'mobile'];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelected((prev) => order[(order.indexOf(prev) + 1) % order.length]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelected((prev) => order[(order.indexOf(prev) - 1 + order.length) % order.length]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(selected);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, onConfirm]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lander-heading"
      className="fixed inset-0 z-50 bg-[#09090b] text-[#f4f4f0] flex flex-col items-center justify-center p-5 md:p-10 overflow-y-auto"
    >
      <div className="w-full max-w-4xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8">
          <Disc3 className="w-7 h-7 text-amber-400 shrink-0" aria-hidden="true" />
          <span className="font-serif text-2xl font-semibold tracking-tight text-[#f4f4f0]">
            StringsArchive
          </span>
          <span aria-hidden="true" className="text-zinc-600">·</span>
          <span className="text-sm text-zinc-400 font-mono tabular-nums">
            {playableCount.toLocaleString()} full shows
          </span>
        </div>

        {/* Detection Banner & Primary Prompt */}
        <div className="mb-8">
          <p className="text-sm font-medium text-amber-400 mb-2">
            Detected: {LAYOUT_MODE_LABELS[detectedMode]}
          </p>
          <h1
            id="lander-heading"
            className="font-serif text-3xl md:text-5xl font-semibold tracking-tight text-[#f4f4f0] text-balance"
          >
            Choose your viewing layout
          </h1>
          <p className="text-sm md:text-base text-zinc-400 mt-3 max-w-2xl">
            Continue with the recommended {LAYOUT_MODE_LABELS[detectedMode]} experience or switch to
            another layout. Your preference is saved locally and can be changed anytime from the
            header.
          </p>
        </div>

        {/* Mode Selection Cards */}
        <div
          role="radiogroup"
          aria-label="Viewing layout mode"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selected === option.id;
            const isDetected = detectedMode === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(option.id)}
                onDoubleClick={() => onConfirm(option.id)}
                className={`text-left p-5 rounded-xl border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isSelected
                    ? 'bg-[#16161c] border-amber-400 ring-2 ring-amber-400/40'
                    : 'bg-[#111115] border-white/[0.08] hover:border-white/25 hover:bg-[#15151a]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-4">
                  <Icon
                    className={`w-6 h-6 ${isSelected ? 'text-amber-400' : 'text-zinc-400'}`}
                    aria-hidden="true"
                  />
                  {isDetected && (
                    <span className="text-xs font-medium text-amber-300">Recommended</span>
                  )}
                </div>

                <h2 className="font-serif text-lg font-semibold text-[#f4f4f0]">
                  {option.title}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">{option.subtitle}</p>
                <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{option.details}</p>
              </button>
            );
          })}
        </div>

        {/* Primary Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/[0.08]">
          <p className="text-xs text-zinc-500">
            Use Left/Right arrow keys and Enter to confirm on TV or keyboard.
          </p>

          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="inline-flex items-center justify-center gap-2.5 h-12 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            <span>Continue in {LAYOUT_MODE_LABELS[selected]} Mode</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
