import { NextRequest, NextResponse } from 'next/server';
import { searchBooks } from '@/lib/books/search';
import { encodeBookRef } from '@/lib/books/ref';

export const runtime = 'nodejs';

/**
 * GET /api/books/search?q=…
 * Федеративный поиск книг по Google Books и OpenLibrary.
 * Используется для клиентского instant-поиска; страница /search
 * вызывает searchBooks() напрямую на сервере.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json(
      { query: q, results: [], respondedSources: [], failedSources: [] },
      { status: 400 },
    );
  }

  try {
    const data = await searchBooks(q);
    const results = data.results.map((b) => ({
      ...b,
      ref: encodeBookRef(b.source, b.sourceId),
    }));
    return NextResponse.json(
      { ...data, results },
      { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600' } },
    );
  } catch {
    return NextResponse.json({ error: 'Ошибка поиска' }, { status: 500 });
  }
}
