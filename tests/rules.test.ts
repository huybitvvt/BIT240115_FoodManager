import { describe, expect, it } from 'vitest';
import { createSeed } from '../src/data/seed';
import { deserializeDatabase, serializeDatabase } from '../src/data/serialization';
import { DEFAULT_FILTERS } from '../src/domain/models';
import { filterDishes, isQuick, priceRangeError, validateDish } from '../src/domain/rules';

describe('đúng ràng buộc đề bài', () => {
  const db = createSeed();
  const dish = db.dishes[0];
  it('có 3 loại, 5 món, quan hệ hợp lệ, một món nhiều ảnh', () => {
    expect(db.categories).toHaveLength(3); expect(db.dishes).toHaveLength(5);
    for (const d of db.dishes) expect(validateDish(d, db.categories, db.dishes, d.id)).toEqual({});
    expect(dish.images.length).toBeGreaterThan(1);
  });
  it('chặn tên rỗng, giá/thời gian không dương hoặc không phải số, loại không tồn tại', () => {
    expect(validateDish({ ...dish, name: ' ', price: NaN, preparationTime: 0, dishCategoryId: 'missing' }, db.categories, db.dishes, dish.id)).toEqual({ name: 'nameRequired', price: 'pricePositive', preparationTime: 'timePositive', dishCategoryId: 'categoryRequired' });
    for (const n of [-1, 0, Infinity, NaN]) expect(validateDish({ ...dish, price: n }, db.categories, [], dish.id).price).toBe('pricePositive');
  });
  it('không trùng tên trong cùng loại, cho phép khác loại hoặc sửa chính món đó', () => {
    expect(validateDish({ ...dish, name: '  PHỞ BÒ  '.normalize('NFD') }, db.categories, db.dishes).name).toBe('duplicateName');
    expect(validateDish(dish, db.categories, db.dishes, dish.id)).toEqual({});
    expect(validateDish({ ...dish, dishCategoryId: db.categories[1].id }, db.categories, db.dishes).name).toBeUndefined();
  });
  it('tối đa một ảnh đại diện, URL hợp lệ; danh sách ảnh trống được phép', () => {
    expect(validateDish({ ...dish, images: dish.images.map(i => ({ ...i, isThumbnail: true })) }, db.categories, [], dish.id).images).toBe('thumbnailOnlyOne');
    expect(validateDish({ ...dish, images: [{ imageUrl: 'file:///a.png', isThumbnail: false }] }, db.categories, [], dish.id).images).toBe('imageUrlInvalid');
    expect(validateDish({ ...dish, images: [] }, db.categories, [], dish.id)).toEqual({});
  });
  it('biên Quick 15 phút và Regular trên 15', () => { expect(isQuick(15)).toBe(true); expect(isQuick(15.1)).toBe(false); });
  it('phối hợp tên, loại, trạng thái và khoảng giá', () => {
    const filters = { ...DEFAULT_FILTERS, search: 'g', categoryId: db.categories[1].id, availableOnly: true, minPrice: '30000', maxPrice: '40000' };
    expect(filterDishes(db.dishes, filters).map(d => d.name)).toEqual(['Gỏi cuốn']);
    expect(filterDishes(db.dishes, DEFAULT_FILTERS).some(d => !d.isAvailable)).toBe(true);
    expect(filterDishes(db.dishes, { ...DEFAULT_FILTERS, availableOnly: true }).every(d => d.isAvailable)).toBe(true);
  });
  it('sắp xếp giá tăng/giảm và thời gian tăng, không đổi mảng gốc', () => {
    const original = db.dishes.map(d => d.id);
    expect(filterDishes(db.dishes, DEFAULT_FILTERS).map(d => d.price)).toEqual([35000, 40000, 45000, 55000, 65000]);
    expect(filterDishes(db.dishes, { ...DEFAULT_FILTERS, sort: 'priceDesc' })[0].price).toBe(65000);
    expect(filterDishes(db.dishes, { ...DEFAULT_FILTERS, sort: 'timeAsc' }).map(d => d.preparationTime)).toEqual([5, 8, 10, 15, 20]);
    expect(db.dishes.map(d => d.id)).toEqual(original);
  });
  it('khoảng giá sai và danh sách trống', () => {
    for (const values of [{ minPrice: '500', maxPrice: '20' }, { minPrice: '-1', maxPrice: '' }, { minPrice: 'abc', maxPrice: '' }, { minPrice: '', maxPrice: 'Infinity' }]) {
      expect(priceRangeError({ ...DEFAULT_FILTERS, ...values })).toBe('invalidPriceRange');
      expect(filterDishes(db.dishes, { ...DEFAULT_FILTERS, ...values })).toEqual([]);
    }
    expect(filterDishes([], DEFAULT_FILTERS)).toEqual([]);
  });
});

describe('tiền tố MSSV khi lưu', () => {
  it('mọi key lưu trữ, kể cả ảnh/hàng đợi, có BIT240115_; roundtrip không mất dữ liệu', () => {
    const db = createSeed(); const raw = serializeDatabase(db);
    const visit = (value: unknown) => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { expect(key.startsWith('BIT240115_')).toBe(true); visit(child); }
    };
    visit(JSON.parse(raw)); expect(deserializeDatabase(raw)).toEqual(db);
  });
  it('không nuốt lỗi JSON hoặc schema sai', () => {
    expect(() => deserializeDatabase('{')).toThrow('dataInvalid');
    expect(() => deserializeDatabase('{"name":"bad schema"}')).toThrow('dataInvalid');
  });
});
