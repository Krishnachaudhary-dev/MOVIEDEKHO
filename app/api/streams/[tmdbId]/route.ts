import { NextResponse } from 'next/server';
import { getStreamsFromSupabase } from '@/lib/supabase-queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  const { tmdbId } = await params;
  const id = Number(tmdbId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: 'tmdbId must be a positive integer.' },
      { status: 400 }
    );
  }

  const response = await getStreamsFromSupabase(id);

  if (!response.record.sources.length) {
    return NextResponse.json({ error: 'No streams found' }, { status: 404 });
  }

  return NextResponse.json(response);
}
