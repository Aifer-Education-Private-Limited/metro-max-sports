import { handle } from '@/lib/http';
import { getSnapshot, replaceAll, validateTournament } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const GET = (req: Request) => handle(() => getSnapshot(new URL(req.url).searchParams.has('fresh')));

export const PUT = (req: Request) =>
  handle(async () => {
    const { revision, data } = await req.json();
    return replaceAll(validateTournament(data), Number(revision));
  }, { admin: true });
