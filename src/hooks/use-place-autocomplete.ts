'use client';

import { useEffect, useState } from 'react';

const placeSuggestionCache = new Map<string, PlaceSuggestion[]>();

export interface PlaceSuggestion {
  id: string;
  displayName: string;
}

export function usePlaceAutocomplete(query: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 500);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const normalized = debouncedQuery.trim().toLowerCase();

    if (!enabled || !normalized || normalized.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = placeSuggestionCache.get(normalized);
    if (cached) {
      setSuggestions(cached);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const encoded = encodeURIComponent(normalized);
    const url = `/api/place-suggestions?q=${encoded}`;

    setLoading(true);
    setError(null);

    fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 429) {
            throw new Error('rate-limit');
          }
          throw new Error('Suggestion proxy request failed');
        }
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          setSuggestions([]);
          return;
        }
        const parsed = data
          .filter((item: any) => item && item.displayName)
          .slice(0, 6)
          .map((item: any) => ({
            id: item.id ? String(item.id) : String(item.displayName),
            displayName: item.displayName,
          }));
        setSuggestions(parsed);
        placeSuggestionCache.set(normalized, parsed);
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') {
          setSuggestions([]);
          setError(
            fetchError.message === 'rate-limit'
              ? 'Too many requests. Please pause and try again.'
              : 'Unable to fetch suggestions.'
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, enabled]);

  return { suggestions, loading, error };
}
