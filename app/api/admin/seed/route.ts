import { handle } from '@/lib/http';
import { ApiError, getSnapshot, replaceAll, seedData } from '@/lib/service';

export const POST = () =>
  handle(async () => {
    if (!(await getSnapshot(true)).empty) throw new ApiError('The database already has data. Use Backup → Restore to replace it.', 409);
    return replaceAll(seedData());
  }, { admin: true });
