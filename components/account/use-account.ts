'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface MeResponse {
  readonly accounts: boolean;
  readonly user: { email: string; verified: boolean; places: string[] } | null;
}

export class AccountError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** JSON request to our own API; errors keep the API's machine code for localized messages. */
export async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new AccountError(data.error ?? 'internal');
  return data as T;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/auth/me', 'GET'),
    staleTime: 60_000,
    retry: false,
  });
}

/** Save or remove a place; the list updates at once and is confirmed by the server. */
export function useSavePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { placeId: string; saved: boolean }) => api('/api/me/places', 'PUT', v),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['me'] });
      const prev = qc.getQueryData<MeResponse>(['me']);
      if (prev?.user) {
        const places = v.saved
          ? [...new Set([...prev.user.places, v.placeId])]
          : prev.user.places.filter((p) => p !== v.placeId);
        qc.setQueryData<MeResponse>(['me'], { ...prev, user: { ...prev.user, places } });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['me'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
