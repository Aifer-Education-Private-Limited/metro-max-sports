import 'server-only';
import { collectionRoutes } from './http';
import { awards, matches, players, rules, sports } from './service';

export const playerRoutes = collectionRoutes(players);
export const matchRoutes = collectionRoutes(matches);
export const awardRoutes = collectionRoutes(awards);
export const ruleRoutes = collectionRoutes(rules);
export const sportRoutes = collectionRoutes(sports);
