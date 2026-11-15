import { connection } from 'next/server';
import { sessionToken } from '@/server/auth/http';
import { accountsAvailable, me } from '@/server/auth/service';
import { jsonError } from '@/server/http';

export async function GET(): Promise<Response> {
  await connection();
  try {
    const user = await me(await sessionToken());
    return Response.json(
      { accounts: accountsAvailable(), user },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('me: failed', error);
    return jsonError(503, 'unavailable', 'Accounts are temporarily unavailable.');
  }
}
