import { createContext, useContext } from 'react';
import { FoodStore, StoreView } from '../data/store';
import { translate } from '../i18n';
import { DishFilters } from '../domain/models';
export type Screen = { name: 'list' } | { name: 'detail'; id: string } | { name: 'form'; id?: string } | { name: 'categories' };
export interface AppContextValue {
  store: FoodStore; view: StoreView; go: (screen: Screen) => void; back: () => void;
  filters: DishFilters; setFilters: (filters: DishFilters) => void;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppContext missing');
  return { ...value, t: (key: string) => translate(value.view.db.language, key) };
}
