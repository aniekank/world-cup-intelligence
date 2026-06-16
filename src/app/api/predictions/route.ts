import { json } from '@/lib/api';
import { predictionsView, bracketView } from '@/server/queries';

export function GET() {
  return json({ ...predictionsView(), bracket: bracketView() }, 'standard');
}

export const dynamic = 'force-dynamic';
