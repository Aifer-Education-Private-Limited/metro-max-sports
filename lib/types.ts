export type Team = 'BI' | 'GL' | '';
export type MatchStatus = 'scheduled' | 'completed' | 'bye';

export interface Player { id: string; name: string; flat: string; team: Team; [extra: string]: unknown }
export interface Match {
  id: string; sport: string; category: string; round: string; roundOrder: number;
  date: string; time: string; venue: string; p1: string; p2: string;
  status: MatchStatus; winner: string; score: string; sourceSheet?: number | '';
  [extra: string]: unknown;
}
export interface Award { id: string; sport: string; category: string; team: Team; place: string; points: number; [extra: string]: unknown }
export interface Rule { place: string; points: number; [extra: string]: unknown }

export interface Tournament { players: Player[]; matches: Match[]; awards: Award[]; rules: Rule[] }
export type Collection = keyof Tournament;
export const COLLECTIONS: Collection[] = ['players', 'matches', 'awards', 'rules'];

export interface TournamentSnapshot { data: Tournament; revision: number; empty: boolean; error?: string }
