import { checkAdminKey, clearAdminCookie, isAdmin, setAdminCookie } from '@/lib/auth';
import { handle } from '@/lib/http';
import { ApiError } from '@/lib/service';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const GET = () => handle(async () => ({ admin: await isAdmin(), configured: !!process.env.ADMIN_KEY, storage: getStore().name }));

export const POST = (req: Request) =>
  handle(async () => {
    if (!process.env.ADMIN_KEY) throw new ApiError('ADMIN_KEY is not set on the server. Editing is disabled.', 500);
    const { key } = await req.json().catch(() => ({}));
    if (!checkAdminKey(key)) throw new ApiError('Invalid admin key.', 401);
    await setAdminCookie(req);
    return { admin: true };
  });

export const DELETE = () => handle(async () => { await clearAdminCookie(); return { admin: false }; });
