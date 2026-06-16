import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { FavoritesClient } from '@/components/favorites/FavoritesClient';

export const metadata: Metadata = { title: 'Favorites' };

export default function FavoritesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Personalization"
        title="Favorites & Watchlist"
        description="Follow teams to build a personalized dashboard. Favorites are stored locally; in production they sync to your account and drive goal/kickoff/result notifications."
      />
      <FavoritesClient />
    </div>
  );
}

export const dynamic = 'force-dynamic';
