import { AppError, Dish, DishCategory, DishDraft, DishFilters } from './models';

export const normalizeName = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('vi');
export const isQuick = (minutes: number) => minutes <= 15;
export const isImageUrl = (value: string) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname; }
  catch { return false; }
};
export function validateDish(draft: DishDraft, categories: DishCategory[], dishes: Dish[], id?: string) {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'nameRequired';
  if (!Number.isFinite(draft.price) || draft.price <= 0) errors.price = 'pricePositive';
  if (!Number.isFinite(draft.preparationTime) || draft.preparationTime <= 0) errors.preparationTime = 'timePositive';
  if (!categories.some(c => c.id === draft.dishCategoryId)) errors.dishCategoryId = 'categoryRequired';
  if (dishes.some(d => d.id !== id && d.dishCategoryId === draft.dishCategoryId && normalizeName(d.name) === normalizeName(draft.name))) {
    errors.name = 'duplicateName';
  }
  if (draft.images.some(image => !isImageUrl(image.imageUrl.trim()))) errors.images = 'imageUrlInvalid';
  if (draft.images.filter(image => image.isThumbnail).length > 1) errors.images = 'thumbnailOnlyOne';
  return errors;
}
export function assertCategoryUnused(id: string, dishes: Dish[]) {
  if (dishes.some(d => d.dishCategoryId === id)) throw new AppError('categoryInUse');
}
export function priceRangeError(filters: DishFilters): string | null {
  const min = filters.minPrice.trim() === '' ? 0 : Number(filters.minPrice);
  const max = filters.maxPrice.trim() === '' ? Infinity : Number(filters.maxPrice);
  return !Number.isFinite(min) || min < 0 || Number.isNaN(max) || max < 0 ||
    (filters.maxPrice.trim() !== '' && !Number.isFinite(max)) || min > max ? 'invalidPriceRange' : null;
}
export function filterDishes(dishes: Dish[], filters: DishFilters): Dish[] {
  if (priceRangeError(filters)) return [];
  const min = filters.minPrice.trim() === '' ? 0 : Number(filters.minPrice);
  const max = filters.maxPrice.trim() === '' ? Infinity : Number(filters.maxPrice);
  const search = normalizeName(filters.search);
  return dishes.filter(d => normalizeName(d.name).includes(search) &&
    (!filters.categoryId || d.dishCategoryId === filters.categoryId) &&
    (!filters.availableOnly || d.isAvailable) && d.price >= min && d.price <= max)
    .sort((a, b) => {
      const order = filters.sort === 'priceAsc' ? a.price - b.price : filters.sort === 'priceDesc' ? b.price - a.price : a.preparationTime - b.preparationTime;
      return order || a.name.localeCompare(b.name, 'vi');
    });
}
