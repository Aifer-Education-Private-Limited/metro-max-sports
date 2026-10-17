import { handle } from '@/lib/http';
import { replaceAll, validateTournament } from '@/lib/service';

export const POST = (req: Request) => handle(async () => replaceAll(validateTournament(await req.json().catch(() => null))), { admin: true });
