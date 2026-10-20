import { AppError, Change, Database, Dish, DishCategory, DishImage } from '../domain/models';
import { TABLES } from '../config';

// Mọi tên bảng và field do ứng dụng lưu đều có tiền tố BIT240115_.
export interface StoredCategory {
  BIT240115_Id: string; BIT240115_Name: string; BIT240115_Description: string;
}
export interface StoredImage { BIT240115_ImageUrl: string; BIT240115_IsThumbnail: boolean }
export interface StoredDish extends StoredCategory {
  BIT240115_Price: number; BIT240115_PreparationTime: number; BIT240115_IsAvailable: boolean;
  BIT240115_DishCategoryId: string; BIT240115_DishImage: StoredImage[];
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('dataInvalid');
  return value as Record<string, unknown>;
};
const str = (value: unknown) => { if (typeof value !== 'string') throw new AppError('dataInvalid'); return value; };
const bool = (value: unknown) => { if (typeof value !== 'boolean') throw new AppError('dataInvalid'); return value; };
const positive = (value: unknown) => { if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new AppError('dataInvalid'); return value; };
export const array = (value: unknown): unknown[] => { if (!Array.isArray(value)) throw new AppError('dataInvalid'); return value; };
export const encodeCategory = (c: DishCategory): StoredCategory => ({ BIT240115_Id: c.id, BIT240115_Name: c.name, BIT240115_Description: c.description });
export const encodeDish = (d: Dish): StoredDish => ({
  ...encodeCategory(d), BIT240115_Price: d.price, BIT240115_PreparationTime: d.preparationTime,
  BIT240115_IsAvailable: d.isAvailable, BIT240115_DishCategoryId: d.dishCategoryId,
  BIT240115_DishImage: d.images.map(i => ({ BIT240115_ImageUrl: i.imageUrl, BIT240115_IsThumbnail: i.isThumbnail })),
});
export function decodeCategory(value: unknown): DishCategory {
  const v = record(value);
  const c = { id: str(v.BIT240115_Id), name: str(v.BIT240115_Name), description: str(v.BIT240115_Description) };
  if (!c.id || !c.name.trim()) throw new AppError('dataInvalid');
  return c;
}
export function decodeDish(value: unknown): Dish {
  const v = record(value);
  const images: DishImage[] = array(v.BIT240115_DishImage).map(value => {
    const i = record(value);
    return { imageUrl: str(i.BIT240115_ImageUrl), isThumbnail: bool(i.BIT240115_IsThumbnail) };
  });
  return { ...decodeCategory(v), price: positive(v.BIT240115_Price), preparationTime: positive(v.BIT240115_PreparationTime),
    isAvailable: bool(v.BIT240115_IsAvailable), dishCategoryId: str(v.BIT240115_DishCategoryId), images };
}
export function serializeDatabase(db: Database): string {
  return JSON.stringify({
    BIT240115_Version: 1,
    [TABLES.category]: db.categories.map(encodeCategory),
    [TABLES.dish]: db.dishes.map(encodeDish),
    BIT240115_Language: db.language,
    BIT240115_PendingChanges: db.pending.map(c => ({ BIT240115_Entity: c.kind, BIT240115_Id: c.id, BIT240115_Action: c.action, BIT240115_Revision: c.revision })),
  });
}
export function deserializeDatabase(raw: string): Database {
  try {
    const v = record(JSON.parse(raw));
    if (v.BIT240115_Version !== 1 || !['en', 'vi'].includes(str(v.BIT240115_Language))) throw new AppError('dataInvalid');
    const pending: Change[] = array(v.BIT240115_PendingChanges).map(value => {
      const p = record(value);
      if (!['category', 'dish'].includes(str(p.BIT240115_Entity)) || !['upsert', 'delete'].includes(str(p.BIT240115_Action))) throw new AppError('dataInvalid');
      return { kind: p.BIT240115_Entity as Change['kind'], action: p.BIT240115_Action as Change['action'], id: str(p.BIT240115_Id), revision: str(p.BIT240115_Revision) };
    });
    return { categories: array(v[TABLES.category]).map(decodeCategory), dishes: array(v[TABLES.dish]).map(decodeDish), pending, language: v.BIT240115_Language as Database['language'] };
  } catch { throw new AppError('dataInvalid'); }
}
