import { NextResponse } from 'next/server';

const suggestionCache = new Map<string, { timestamp: number; suggestions: Array<{ id: string; displayName: string }> }>();
const CACHE_TTL_MS = 60_000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim() ?? '';
  const normalizedQuery = query.toLowerCase();

  if (query.length < 3) {
    return NextResponse.json([]);
  }

  const cached = suggestionCache.get(normalizedQuery);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.suggestions);
  }

  const endpoint = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(
    query
  )}`;

  try {
    const requestOrigin = req.headers.get('origin') || `https://${req.headers.get('host') ?? 'localhost:3000'}`;
    const frontendOrigin = process.env.NEXT_PUBLIC_APP_URL || requestOrigin;
    const userAgent = `CobitunAutocomplete/1.0 (+${frontendOrigin})`;

    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
        Referer: frontendOrigin,
      },
    });

    if (!response.ok) {
      if (response.status === 429 && cached) {
        return NextResponse.json(cached.suggestions);
      }
      return NextResponse.json([], { status: response.status });
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return NextResponse.json([], { status: 502 });
    }

    const suggestions = data
      .filter((item: any) => item && item.display_name)
      .slice(0, 6)
      .map((item: any) => ({
        id: item.place_id ? String(item.place_id) : item.osm_id ? String(item.osm_id) : String(item.display_name),
        displayName: item.display_name,
      }));

    suggestionCache.set(normalizedQuery, { timestamp: now, suggestions });
    return NextResponse.json(suggestions);
  } catch (error) {
    if (cached) {
      return NextResponse.json(cached.suggestions);
    }
    return NextResponse.json([], { status: 500 });
  }
}
