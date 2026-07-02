import { json, error } from '@/lib/api';
import { smartAnswer } from '@/ai/llmParse';
import { z } from 'zod';

const schema = z.object({ query: z.string().min(1).max(280) });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error('A non-empty "query" (<=280 chars) is required');
  return json(await smartAnswer(parsed.data.query), 'standard');
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q');
  if (!q) return error('Provide ?q=<question>');
  return json(await smartAnswer(q), 'standard');
}

export const dynamic = 'force-dynamic';
