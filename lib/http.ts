import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from './auth';
import { ApiError, createItem, deleteItem, updateItem, type CollectionSpec } from './service';

export async function handle(fn: () => Promise<unknown>, opts: { admin?: boolean } = {}) {
  try {
    if (opts.admin && !(await isAdmin())) throw new ApiError('Admin login required.', 401);
    return NextResponse.json(await fn(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    if (status === 500) console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}

const body = async (req: Request) => {
  try { return (await req.json()) as Record<string, unknown>; } catch { throw new ApiError('Request body must be JSON.'); }
};

type Ctx = { params: Promise<Record<string, string>> };

/** Route handlers for POST /api/<collection> and PUT/DELETE /api/<collection>/<key>. */
export function collectionRoutes<T>(spec: CollectionSpec<T>) {
  return {
    list: {
      POST: (req: Request) => handle(async () => createItem(spec, await body(req)), { admin: true }),
    },
    item: {
      PUT: (req: Request, ctx: Ctx) => handle(async () => updateItem(spec, Object.values(await ctx.params)[0], await body(req)), { admin: true }),
      DELETE: (_req: Request, ctx: Ctx) => handle(async () => deleteItem(spec, Object.values(await ctx.params)[0]), { admin: true }),
    },
  };
}
