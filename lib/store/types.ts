import type { Collection, Tournament } from '../types';

export class ConflictError extends Error {}

export interface Store {
  name: string;
  load(): Promise<{ data: Tournament; revision: number }>;
  /** Writes the changed collections. Throws ConflictError if the stored revision is no longer `expectedRevision`. Returns the new revision. */
  write(data: Tournament, changed: Collection[], expectedRevision: number): Promise<number>;
}

export const FIELDS: Record<Collection, { sheet: string; key: string; fields: string[]; numeric: string[] }> = {
  players: { sheet: 'Players', key: 'id', fields: ['id', 'name', 'flat', 'team'], numeric: [] },
  matches: {
    sheet: 'Matches', key: 'id',
    fields: ['id', 'sport', 'category', 'round', 'roundOrder', 'date', 'time', 'venue', 'p1', 'p2', 'status', 'winner', 'score', 'sourceSheet'],
    numeric: ['roundOrder', 'sourceSheet'],
  },
  awards: { sheet: 'Awards', key: 'id', fields: ['id', 'sport', 'category', 'team', 'place', 'points'], numeric: ['points'] },
  rules: { sheet: 'Rules', key: 'place', fields: ['place', 'points'], numeric: ['points'] },
};
