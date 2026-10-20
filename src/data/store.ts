import { DATABASE_KEY } from '../config';
import { AppError, Change, Database, Dish, DishCategory, DishDraft, EntityKind, Language, newId } from '../domain/models';
import { assertCategoryUnused, validateDish } from '../domain/rules';
import { createSeed } from './seed';
import { deserializeDatabase, serializeDatabase } from './serialization';

export interface KeyValueStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export interface RemoteRecord<T> { serverId: string; value: T }
export interface RemoteData { categories: RemoteRecord<DishCategory>[]; dishes: RemoteRecord<Dish>[] }
export interface Gateway {
  read(): Promise<RemoteData>;
  save(kind: EntityKind, value: DishCategory | Dish, serverId?: string): Promise<RemoteRecord<DishCategory | Dish>>;
  remove(kind: EntityKind, serverId: string): Promise<void>;
}
export interface StoreView {
  db: Database; ready: boolean; connected: boolean; configured: boolean;
  syncing: boolean; syncError: string | null; loadError: string | null;
}
const emptyDb = (): Database => ({ categories: [], dishes: [], pending: [], language: 'en' });
const errorCode = (error: unknown, fallback: string) => error instanceof AppError ? error.code : fallback;
export function assertDatabase(db: Pick<Database, 'categories' | 'dishes'>) {
  if (new Set(db.categories.map(c => c.id)).size !== db.categories.length || new Set(db.dishes.map(d => d.id)).size !== db.dishes.length) throw new AppError('dataInvalid');
  for (const d of db.dishes) {
    if (Object.keys(validateDish(d, db.categories, db.dishes, d.id)).length) throw new AppError('dataInvalid');
  }
}

/** Offline-first: lưu snapshot + hàng đợi trong cùng một lần setItem. */
export class FoodStore {
  private view: StoreView = { db: emptyDb(), ready: false, connected: false, configured: false, syncing: false, syncError: null, loadError: null };
  private listeners = new Set<() => void>();
  private writes: Promise<unknown> = Promise.resolve();
  private activeSync: Promise<void> | null = null;
  constructor(private storage: KeyValueStorage, private gateway?: Gateway) { this.view.configured = !!gateway; }
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<StoreView>) { this.view = { ...this.view, ...patch }; this.listeners.forEach(l => l()); }
  private transaction(update: (db: Database) => Database): Promise<void> {
    const task = this.writes.then(async () => {
      const next = update(this.view.db);
      try { await this.storage.setItem(DATABASE_KEY, serializeDatabase(next)); }
      catch { throw new AppError('storageError'); }
      this.publish({ db: next });
    });
    this.writes = task.catch(() => {});
    return task;
  }
  async initialize() {
    if (this.view.ready) return;
    this.publish({ loadError: null });
    try {
      const raw = await this.storage.getItem(DATABASE_KEY);
      const db = raw === null ? createSeed() : deserializeDatabase(raw);
      assertDatabase(db);
      await this.transaction(() => db);
      this.publish({ ready: true });
    } catch (error) { this.publish({ loadError: errorCode(error, 'storageError') }); }
  }
  setConnected(connected: boolean) { if (connected !== this.view.connected) this.publish({ connected }); }
  setLanguage(language: Language) { return this.transaction(db => ({ ...db, language })); }
  private enqueue(db: Database, kind: EntityKind, id: string, action: Change['action']): Change[] {
    return [...db.pending.filter(c => !(c.kind === kind && c.id === id)), { kind, id, action, revision: newId() }];
  }
  async saveDish(draft: DishDraft, id?: string): Promise<string> {
    const targetId = id ?? newId();
    await this.transaction(db => {
      if (id && !db.dishes.some(d => d.id === id)) throw new AppError('notFound');
      const errors = validateDish(draft, db.categories, db.dishes, id);
      if (Object.keys(errors).length) throw new AppError(Object.values(errors)[0]);
      const dish: Dish = { ...draft, id: targetId, name: draft.name.trim(), description: draft.description.trim(), images: draft.images.map(i => ({ ...i, imageUrl: i.imageUrl.trim() })) };
      return { ...db, dishes: id ? db.dishes.map(d => d.id === id ? dish : d) : [...db.dishes, dish], pending: this.enqueue(db, 'dish', targetId, 'upsert') };
    });
    return targetId;
  }
  deleteDish(id: string) {
    return this.transaction(db => {
      if (!db.dishes.some(d => d.id === id)) throw new AppError('notFound');
      return { ...db, dishes: db.dishes.filter(d => d.id !== id), pending: this.enqueue(db, 'dish', id, 'delete') };
    });
  }
  deleteCategory(id: string) {
    return this.transaction(db => {
      if (!db.categories.some(c => c.id === id)) throw new AppError('notFound');
      assertCategoryUnused(id, db.dishes);
      return { ...db, categories: db.categories.filter(c => c.id !== id), pending: this.enqueue(db, 'category', id, 'delete') };
    });
  }
  synchronize(): Promise<void> {
    // Một tiến trình sync duy nhất; không POST song song cùng một món.
    if (this.activeSync) return this.activeSync;
    if (!this.view.ready || !this.view.connected || !this.gateway) return Promise.resolve();
    this.publish({ syncing: true, syncError: null });
    this.activeSync = this.runSync().catch(error => {
      this.publish({ syncError: errorCode(error, 'apiError') });
    }).finally(() => {
      this.activeSync = null;
      this.publish({ syncing: false });
    });
    return this.activeSync;
  }
  private async runSync() {
    const api = this.gateway!;
    // Đọc lại server trước khi retry POST: phục hồi được cả trường hợp server
    // đã tạo thành công nhưng thiết bị mất mạng trước khi nhận response.
    let remote = await api.read();
    assertDatabase({ categories: remote.categories.map(r => r.value), dishes: remote.dishes.map(r => r.value) });
    // Xóa món cũ trước khi ghi món mới: offline có thể xóa rồi tạo lại
    // cùng tên trong cùng loại. Loại luôn được tạo trước/xóa sau các món.
    const rank = (c: Change) => c.kind === 'category' ? c.action === 'upsert' ? 0 : 3 : c.action === 'delete' ? 1 : 2;
    const batch = [...this.view.db.pending].sort((a, b) => rank(a) - rank(b));
    for (const entry of batch) {
      if (!this.view.connected) return;
      const change = this.view.db.pending.find(c => c.kind === entry.kind && c.id === entry.id);
      if (!change) continue;
      const key = change.kind === 'category' ? 'categories' : 'dishes';
      const existing = remote[key].find(r => r.value.id === change.id);
      // Cài lại ứng dụng không được ghi đè món đã sửa trên server bằng seed.
      if (change.action === 'upsert' && change.revision.startsWith('seed_') && existing) {
        await this.transaction(db => ({ ...db, pending: db.pending.filter(c => c.revision !== change.revision) }));
        continue;
      }
      if (change.action === 'delete') {
        if (change.kind === 'category') assertCategoryUnused(change.id, remote.dishes.map(r => r.value));
        if (existing) await api.remove(change.kind, existing.serverId);
        if (key === 'categories') remote.categories = remote.categories.filter(r => r.value.id !== change.id);
        else remote.dishes = remote.dishes.filter(r => r.value.id !== change.id);
      } else {
        const value = this.view.db[key].find(v => v.id === change.id);
        if (!value) continue;
        if (change.kind === 'dish') {
          const errors = validateDish(value as Dish, remote.categories.map(r => r.value), remote.dishes.map(r => r.value), change.id);
          if (Object.keys(errors).length) throw new AppError('syncConflict');
        }
        const saved = await api.save(change.kind, value, existing?.serverId);
        if (key === 'categories') remote.categories = [...remote.categories.filter(r => r.value.id !== change.id), saved as RemoteRecord<DishCategory>];
        else remote.dishes = [...remote.dishes.filter(r => r.value.id !== change.id), saved as RemoteRecord<Dish>];
      }
      // Chỉ xóa đúng revision đã gửi. Sửa/xóa trong lúc request đang chạy
      // vẫn nằm trong hàng đợi và sẽ được gửi trong lượt tiếp theo.
      await this.transaction(db => ({ ...db, pending: db.pending.filter(c => c.revision !== change.revision) }));
    }
    remote = await api.read();
    await this.transaction(db => {
      const merge = <T extends { id: string }>(kind: EntityKind, local: T[], rows: RemoteRecord<T>[]) => {
        const dirtyIds = new Set(db.pending.filter(c => c.kind === kind).map(c => c.id));
        return [...rows.map(r => r.value).filter(v => !dirtyIds.has(v.id)), ...local.filter(v => dirtyIds.has(v.id))];
      };
      const merged = { ...db, categories: merge('category', db.categories, remote.categories), dishes: merge('dish', db.dishes, remote.dishes) };
      assertDatabase(merged);
      return merged;
    });
  }
}
