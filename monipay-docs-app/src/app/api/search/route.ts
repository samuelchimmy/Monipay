import { NextResponse } from 'next/server';
import { search } from '@/lib/search';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  if (query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await search(query);
  return NextResponse.json({ results });
}
