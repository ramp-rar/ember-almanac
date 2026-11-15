import { connection } from 'next/server';
import { getHealth } from '@/server/services/meta-service';

export async function GET(): Promise<Response> {
  await connection(); // always computed at request time
  const health = await getHealth(new Date());
  return Response.json(health, { headers: { 'Cache-Control': 'no-store' } });
}
