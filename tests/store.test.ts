import { describe, expect, it } from 'vitest';
import { DATABASE_KEY } from '../src/config';
import { Gateway, FoodStore, KeyValueStorage, RemoteData, RemoteRecord } from '../src/data/store';
import { Dish, DishCategory, EntityKind } from '../src/domain/models';
import { deserializeDatabase } from '../src/data/serialization';

class MemoryStorage implements KeyValueStorage {
  value: string | null = null; failWrite = false;
  async getItem(key: string) { expect(key).toBe(DATABASE_KEY); return this.value; }
  async setItem(key: string, value: string) { expect(key).toBe(DATABASE_KEY); if (this.failWrite) throw new Error('disk full'); this.value = value; }
}
class FakeApi implements Gateway {
  data: RemoteData = { categories: [], dishes: [] };
  events: string[] = []; nextId = 1;
  beforeSave?: (kind: EntityKind, value: DishCategory | Dish) => Promise<void>;
  loseNextResponse = false;
  async read() { return structuredClone(this.data); }
  async save(kind: EntityKind, value: DishCategory | Dish, serverId?: string): Promise<RemoteRecord<DishCategory | Dish>> {
    await this.beforeSave?.(kind, value);
    this.events.push(`${serverId ? 'PUT' : 'POST'}:${kind}:${value.id}`);
    const row = { serverId: serverId ?? String(this.nextId++), value: structuredClone(value) };
    if (kind === 'category') this.data.categories = [...this.data.categories.filter(r => r.serverId !== row.serverId), row as RemoteRecord<DishCategory>];
    else this.data.dishes = [...this.data.dishes.filter(r => r.serverId !== row.serverId), row as RemoteRecord<Dish>];
    if (this.loseNextResponse) { this.loseNextResponse = false; throw new Error('response lost after commit'); }
    return row;
  }
  async remove(kind: EntityKind, serverId: string) {
    this.events.push(`DELETE:${kind}:${serverId}`);
    if (kind === 'category') this.data.categories = this.data.categories.filter(r => r.serverId !== serverId);
    else this.data.dishes = this.data.dishes.filter(r => r.serverId !== serverId);
  }
}
async function setup() {
  const storage = new MemoryStorage(); const api = new FakeApi(); const store = new FoodStore(storage, api);
  await store.initialize(); return { storage, api, store };
}
async function online(store: FoodStore) { store.setConnected(true); await store.synchronize(); }
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };

describe('offline và tự đồng bộ', () => {
  it('xóa món offline rồi tạo lại cùng tên vẫn tự đồng bộ, không kẹt vì tên cũ trên server', async () => {
    const { store, api } = await setup(); await online(store);
    const oldDish = store.getSnapshot().db.dishes[0];
    store.setConnected(false);
    await store.deleteDish(oldDish.id);
    const replacementId = await store.saveDish({ ...oldDish, price: 72000 });
    await online(store);
    expect(store.getSnapshot().syncError).toBeNull();
    expect(store.getSnapshot().db.pending).toHaveLength(0);
    expect(api.data.dishes.some(r => r.value.id === oldDish.id)).toBe(false);
    const matches = api.data.dishes.filter(r => r.value.name === oldDish.name && r.value.dishCategoryId === oldDish.dishCategoryId);
    expect(matches).toHaveLength(1);
    expect(matches[0].value.id).toBe(replacementId);
    expect(matches[0].value.price).toBe(72000);
  });
  it('tạo/sửa offline, giữ qua lần mở lại, đẩy loại trước món và không tạo bản ghi trùng', async () => {
    const { storage, api, store } = await setup();
    const seed = store.getSnapshot().db.dishes[0];
    const id = await store.saveDish({ ...seed, name: 'Món offline', images: [] });
    await store.saveDish({ ...seed, name: 'Món offline', price: 61000, images: [] }, id);
    expect(api.events).toEqual([]);
    const restarted = new FoodStore(storage, api); await restarted.initialize();
    expect(restarted.getSnapshot().db.dishes.find(d => d.id === id)?.price).toBe(61000);
    await online(restarted);
    expect(api.data.categories).toHaveLength(3); expect(api.data.dishes).toHaveLength(6);
    expect(api.data.dishes.find(r => r.value.id === id)?.value.price).toBe(61000);
    expect(api.events.slice(0, 3).every(e => e.startsWith('POST:category'))).toBe(true);
    expect(restarted.getSnapshot().db.pending).toHaveLength(0);
    await Promise.all([restarted.synchronize(), restarted.synchronize()]);
    expect(api.data.dishes.filter(r => r.value.id === id)).toHaveLength(1);
  });
  it('retry sau POST thành công nhưng mất response không tạo trùng', async () => {
    const { store, api } = await setup(); await online(store);
    const id = await store.saveDish({ ...store.getSnapshot().db.dishes[0], name: 'Mất response' });
    api.loseNextResponse = true; await store.synchronize();
    expect(store.getSnapshot().syncError).toBe('apiError');
    expect(store.getSnapshot().db.pending).toHaveLength(1);
    await store.synchronize();
    expect(store.getSnapshot().syncError).toBeNull(); expect(store.getSnapshot().db.pending).toHaveLength(0);
    expect(api.events.filter(e => e === `POST:dish:${id}`)).toHaveLength(1);
    expect(api.data.dishes.filter(r => r.value.id === id)).toHaveLength(1);
  });
  it('sửa trong lúc request chạy không bị acknowledgment cũ xóa mất', async () => {
    const { store, api } = await setup(); await online(store);
    const dish = store.getSnapshot().db.dishes[0];
    await store.saveDish({ ...dish, price: 70000 }, dish.id);
    const started = deferred(), release = deferred();
    api.beforeSave = async () => { started.resolve(); await release.promise; };
    const firstSync = store.synchronize(); await started.promise;
    await store.saveDish({ ...dish, price: 80000 }, dish.id);
    release.resolve(); await firstSync;
    expect(store.getSnapshot().db.dishes.find(d => d.id === dish.id)?.price).toBe(80000);
    expect(store.getSnapshot().db.pending).toHaveLength(1);
    api.beforeSave = undefined; await store.synchronize();
    expect(api.data.dishes.find(r => r.value.id === dish.id)?.value.price).toBe(80000);
    expect(store.getSnapshot().db.pending).toHaveLength(0);
  });
  it('xóa trong khi tạo đang gửi giữ tombstone và xóa server ở lượt sau', async () => {
    const { store, api } = await setup(); await online(store);
    const id = await store.saveDish({ ...store.getSnapshot().db.dishes[0], name: 'Tạo rồi xóa' });
    const started = deferred(), release = deferred();
    api.beforeSave = async () => { started.resolve(); await release.promise; };
    const sync = store.synchronize(); await started.promise; await store.deleteDish(id); release.resolve(); await sync;
    expect(store.getSnapshot().db.dishes.some(d => d.id === id)).toBe(false);
    expect(store.getSnapshot().db.pending[0].action).toBe('delete');
    api.beforeSave = undefined; await store.synchronize();
    expect(api.data.dishes.some(r => r.value.id === id)).toBe(false);
  });
  it('nhận thay đổi từ server; cài lại không ghi đè seed lên món đã sửa', async () => {
    const { store, storage, api } = await setup(); await online(store);
    api.data.dishes[0].value.price = 99000; await store.synchronize();
    expect(store.getSnapshot().db.dishes.find(d => d.id === api.data.dishes[0].value.id)?.price).toBe(99000);
    storage.value = null;
    const reinstall = new FoodStore(storage, api); await reinstall.initialize(); await online(reinstall);
    expect(reinstall.getSnapshot().db.dishes.find(d => d.id === api.data.dishes[0].value.id)?.price).toBe(99000);
  });
  it('xung đột tên trên server giữ thay đổi local và không POST món trùng', async () => {
    const { store, api } = await setup(); await online(store);
    const dish = store.getSnapshot().db.dishes[0];
    const id = await store.saveDish({ ...dish, name: 'Món xung đột' });
    api.data.dishes.push({ serverId: 'external', value: { ...dish, id: 'external-id', name: 'MÓN XUNG ĐỘT' } });
    await store.synchronize();
    expect(store.getSnapshot().syncError).toBe('syncConflict');
    expect(store.getSnapshot().db.dishes.some(d => d.id === id)).toBe(true);
    expect(store.getSnapshot().db.pending).toHaveLength(1);
    expect(api.data.dishes.some(r => r.value.id === id)).toBe(false);
  });
});

describe('lưu trữ và ràng buộc', () => {
  it('chặn xóa loại đang dùng, cho xóa khi món đã được xóa, đồng bộ đúng thứ tự', async () => {
    const { store, api } = await setup(); await online(store);
    const category = store.getSnapshot().db.categories[2];
    await expect(store.deleteCategory(category.id)).rejects.toThrow('categoryInUse');
    for (const d of store.getSnapshot().db.dishes.filter(d => d.dishCategoryId === category.id)) await store.deleteDish(d.id);
    await store.deleteCategory(category.id); api.events = []; await store.synchronize();
    expect(api.events[0]).toMatch(/^DELETE:dish/); expect(api.events[1]).toMatch(/^DELETE:category/);
    expect(api.data.categories.some(r => r.value.id === category.id)).toBe(false);
  });
  it('Id không tồn tại báo lỗi và không làm thay đổi dữ liệu', async () => {
    const { store } = await setup();
    await expect(store.deleteDish('missing')).rejects.toThrow('notFound');
    await expect(store.deleteCategory('missing')).rejects.toThrow('notFound');
    await expect(store.saveDish(store.getSnapshot().db.dishes[0], 'missing')).rejects.toThrow('notFound');
    expect(store.getSnapshot().db.dishes).toHaveLength(5);
  });
  it('lỗi lưu không báo thành công hoặc mất dữ liệu cũ; lần lưu sau vẫn hoạt động', async () => {
    const { store, storage } = await setup(); const before = storage.value;
    storage.failWrite = true; await expect(store.deleteDish(store.getSnapshot().db.dishes[0].id)).rejects.toThrow('storageError');
    expect(storage.value).toBe(before); expect(store.getSnapshot().db.dishes).toHaveLength(5);
    storage.failWrite = false; await store.setLanguage('vi');
    expect(deserializeDatabase(storage.value!).language).toBe('vi');
  });
  it('không ghi đè dữ liệu local hỏng bằng seed', async () => {
    const storage = new MemoryStorage(); storage.value = '{broken';
    const store = new FoodStore(storage); await store.initialize();
    expect(store.getSnapshot().loadError).toBe('dataInvalid'); expect(store.getSnapshot().ready).toBe(false); expect(storage.value).toBe('{broken');
  });
});
