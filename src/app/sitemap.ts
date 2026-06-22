import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://world-cup-intelligence.onrender.com';

// Main sections. Dynamic team/match/player pages are crawlable via links; we
// don't enumerate them here to keep the sitemap small and stable.
const ROUTES = [
  '', '/lab', '/civilizations', '/matches', '/teams', '/players', '/predictions',
  '/standings', '/bracket', '/defense', '/track-record', '/betting', '/rankings',
  '/analytics', '/insights', '/storylines', '/clubs', '/discoveries', '/history',
  '/globe', '/groups', '/ask', '/guide',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({
    url: `${SITE}${r}`,
    changeFrequency: 'daily',
    priority: r === '' ? 1 : 0.7,
  }));
}
