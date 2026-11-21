import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { NUGS_CATALOG_BY_DATE } from './src/data/nugsCatalog';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CachedLookup {
  expiresAt: number;
  payload: unknown;
}

const lookupCache = new Map<string, CachedLookup>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '512kb' }));

  /**
   * Unauthenticated public Nugs catalog lookup by performanceDate (YYYY-MM-DD).
   * Proxies catalog.nugs.net (which blocks direct cross-origin browser fetch via CORS)
   * and returns only public show metadata (showId, venue, artwork URL, play.nugs.net link).
   */
  app.get('/api/nugs/date/:date', async (req, res) => {
    const { date } = req.params;
    if (!DATE_PATTERN.test(date)) {
      res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
      return;
    }

    const cached = lookupCache.get(date);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    const staticEntry = NUGS_CATALOG_BY_DATE[date];

    try {
      const upstreamUrl = new URL('https://catalog.nugs.net/api/v1/releases');
      upstreamUrl.searchParams.set('limit', '50');
      upstreamUrl.searchParams.set('offset', '0');
      upstreamUrl.searchParams.set('performanceDate', date);
      upstreamUrl.searchParams.set('orderBy', 'date');
      upstreamUrl.searchParams.set('order', 'desc');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const upstream = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'StringsArchive/1.0',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (upstream.ok) {
        const data = (await upstream.json()) as {
          items?: Array<{
            id?: string | number;
            title?: string;
            performanceDate?: string;
            hasVideoOnDemand?: boolean;
            image?: { url?: string };
            venue?: { name?: string; city?: string; state?: string };
            artist?: { id?: string | number; name?: string; abbreviation?: string };
          }>;
        };

        const items = Array.isArray(data?.items) ? data.items : [];
        const match = items.find(
          (item) =>
            String(item?.artist?.id) === '1125' ||
            item?.artist?.abbreviation?.toLowerCase() === 'bstr' ||
            item?.artist?.name?.toLowerCase().includes('billy strings')
        );

        if (match && match.id) {
          const showId = String(match.id);
          const payload = {
            found: true,
            source: 'live',
            date,
            nugsShowId: showId,
            title: match.title ?? '',
            venue: match.venue?.name ?? '',
            city: match.venue?.city ?? '',
            state: match.venue?.state ?? '',
            hasVideoOnDemand: Boolean(match.hasVideoOnDemand),
            artworkUrl: match.image?.url
              ? `${match.image.url.split('?')[0]}?w=600&h=600`
              : staticEntry?.artworkUrl ?? null,
            nugsUrl: `https://play.nugs.net/release/${encodeURIComponent(showId)}`,
          };
          lookupCache.set(date, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
          res.json(payload);
          return;
        }
      }
    } catch {
      // Upstream unavailable or timed out — fall back to static verified metadata below
    }

    if (staticEntry) {
      const payload = {
        found: true,
        source: 'static',
        date,
        nugsShowId: staticEntry.nugsShowId,
        hasVideoOnDemand: Boolean(staticEntry.hasVideoOnDemand),
        artworkUrl: staticEntry.artworkUrl ?? null,
        nugsUrl: `https://play.nugs.net/release/${encodeURIComponent(staticEntry.nugsShowId)}`,
      };
      res.json(payload);
      return;
    }

    res.json({
      found: false,
      source: 'none',
      date,
      nugsShowId: null,
      artworkUrl: null,
      nugsUrl: `https://play.nugs.net/search?q=${encodeURIComponent(`Billy Strings ${date}`)}`,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StringsArchive server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
