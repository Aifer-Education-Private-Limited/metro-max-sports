import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import type { Collection, Tournament } from '../types';
import { ConflictError, type Store } from './types';

const empty = (): Tournament => ({ players: [], matches: [], awards: [], rules: [], sports: [] });

/** Development store: a JSON file on disk. Not suitable for serverless hosting. */
export function fileStore(): Store {
  const file = path.resolve(process.env.LOCAL_DB_PATH || '.data/db.json');
  const read = async (): Promise<{ data: Tournament; revision: number }> => {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      return { data: empty(), revision: 0 };
    }
  };
  return {
    name: 'file',
    load: read,
    async write(data: Tournament, _changed: Collection[], expectedRevision: number) {
      const current = await read();
      if (current.revision !== expectedRevision) throw new ConflictError('Revision changed');
      const revision = current.revision + 1;
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify({ revision, data }, null, 1));
      return revision;
    },
  };
}
