export interface DishCategory { id: string; name: string; description: string }
export interface DishImage { imageUrl: string; isThumbnail: boolean }
export interface Dish {
  id: string;
  name: string;
  price: number;
  preparationTime: number;
  isAvailable: boolean;
  description: string;
  dishCategoryId: string;
  images: DishImage[];
}
export type DishDraft = Omit<Dish, 'id'>;
export type Language = 'en' | 'vi';
export type EntityKind = 'category' | 'dish';
export interface Change { kind: EntityKind; id: string; action: 'upsert' | 'delete'; revision: string }
export interface Database {
  categories: DishCategory[];
  dishes: Dish[];
  pending: Change[];
  language: Language;
}
export interface DishFilters {
  search: string;
  categoryId: string;
  availableOnly: boolean;
  minPrice: string;
  maxPrice: string;
  sort: 'priceAsc' | 'priceDesc' | 'timeAsc';
}
export const DEFAULT_FILTERS: DishFilters = {
  search: '', categoryId: '', availableOnly: false, minPrice: '', maxPrice: '', sort: 'priceAsc',
};
export class AppError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'AppError'; }
}
export const newId = () => `BIT240115_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
