import type { LucideIcon } from 'lucide-react';
import {
  Globe2,
  LayoutDashboard,
  Radio,
  CalendarDays,
  Newspaper,
  Shield,
  ShieldHalf,
  Users,
  Layers,
  Table2,
  Trophy,
  Sparkles,
  Target,
  LineChart,
  Award,
  Brain,
  Search,
  Star,
  BookOpen,
  History,
  Shirt,
  Gem,
  Coins,
  LayoutGrid,
  LifeBuoy,
  FlaskConical,
  Swords,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section: 'main' | 'analyze' | 'discover';
  badge?: 'live';
}

export const NAV: NavItem[] = [
  { label: 'World Explorer', href: '/globe', icon: Globe2, section: 'main' },
  { label: 'Home', href: '/', icon: LayoutDashboard, section: 'main' },
  { label: 'Guide', href: '/guide', icon: LifeBuoy, section: 'main' },
  { label: 'Live Center', href: '/live', icon: Radio, section: 'main', badge: 'live' },
  { label: 'Matches', href: '/matches', icon: CalendarDays, section: 'main' },
  { label: 'Results', href: '/results', icon: Newspaper, section: 'main' },
  { label: 'Teams', href: '/teams', icon: Shield, section: 'main' },
  { label: 'Players', href: '/players', icon: Users, section: 'main' },

  { label: 'Groups', href: '/groups', icon: Layers, section: 'analyze' },
  { label: 'Standings', href: '/standings', icon: Table2, section: 'analyze' },
  { label: 'Bracket', href: '/bracket', icon: Trophy, section: 'analyze' },
  { label: 'Predictions', href: '/predictions', icon: Sparkles, section: 'analyze' },
  { label: 'Track Record', href: '/track-record', icon: Target, section: 'analyze' },
  { label: 'Betting Edge', href: '/betting', icon: Coins, section: 'analyze' },
  { label: 'Analytics', href: '/analytics', icon: LineChart, section: 'analyze' },
  { label: 'Model Lab', href: '/lab', icon: FlaskConical, section: 'analyze' },
  { label: 'Defense', href: '/defense', icon: ShieldHalf, section: 'analyze' },
  { label: 'Card Builder', href: '/compare', icon: LayoutGrid, section: 'analyze' },
  { label: 'Rankings', href: '/rankings', icon: Award, section: 'analyze' },

  { label: 'Clash of Civilizations', href: '/civilizations', icon: Swords, section: 'discover' },
  { label: 'Discoveries', href: '/discoveries', icon: Gem, section: 'discover' },
  { label: 'Club Connections', href: '/clubs', icon: Shirt, section: 'discover' },
  { label: 'Through the Years', href: '/history', icon: History, section: 'discover' },
  { label: 'Storylines', href: '/storylines', icon: BookOpen, section: 'discover' },
  { label: 'AI Insights', href: '/insights', icon: Brain, section: 'discover' },
  { label: 'Ask', href: '/ask', icon: Search, section: 'discover' },
  { label: 'Favorites', href: '/favorites', icon: Star, section: 'discover' },
];

export const SECTION_LABEL: Record<NavItem['section'], string> = {
  main: 'Overview',
  analyze: 'Analyze',
  discover: 'Discover',
};
