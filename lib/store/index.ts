import 'server-only';
import { fileStore } from './file';
import { sheetsStore } from './sheets';
import type { Store } from './types';

let store: Store | undefined;

export function getStore(): Store {
  if (!store) store = process.env.GOOGLE_SHEET_ID ? sheetsStore() : fileStore();
  return store;
}
