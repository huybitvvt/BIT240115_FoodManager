import { TABLES } from '../config';
import { AppError, Dish, DishCategory, EntityKind } from '../domain/models';
import { array, decodeCategory, decodeDish, encodeCategory, encodeDish } from './serialization';
import { Gateway, RemoteData, RemoteRecord } from './store';

export class MockApi implements Gateway {
  constructor(private baseUrl: string) {}
  private async request(path: string, method = 'GET', payload?: unknown) {
    let base: URL;
    try { base = new URL(this.baseUrl); }
    catch { throw new AppError('apiUrlInvalid'); }
    if (base.protocol !== 'https:' || !base.hostname.endsWith('.mockapi.io') || base.search || base.hash) throw new AppError('apiUrlInvalid');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${this.baseUrl}/${path}`, {
        method, headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (method === 'DELETE' && response.status === 404) return null;
      if (!response.ok) throw new AppError(response.status === 404 ? 'apiResourceMissing' : 'apiError');
      return await response.json();
    } catch (error) { if (error instanceof AppError) throw error; throw new AppError('apiError'); }
    finally { clearTimeout(timer); }
  }
  private decode<T>(value: unknown, decode: (v: unknown) => T): RemoteRecord<T> {
    if (!value || typeof value !== 'object' || !('id' in value) || !['string', 'number'].includes(typeof value.id) || String(value.id) === '') throw new AppError('dataInvalid');
    // `id` là metadata định tuyến do MockAPI tự cấp, không phải Id nghiệp vụ.
    // Model và dữ liệu local dùng BIT240115_Id; không lưu field `id` của server.
    return { serverId: String(value.id), value: decode(value) };
  }
  async read(): Promise<RemoteData> {
    const [categories, dishes] = await Promise.all([this.request(TABLES.category), this.request(TABLES.dish)]);
    return { categories: array(categories).map(v => this.decode(v, decodeCategory)), dishes: array(dishes).map(v => this.decode(v, decodeDish)) };
  }
  async save(kind: EntityKind, value: DishCategory | Dish, serverId?: string) {
    const data = kind === 'category' ? encodeCategory(value) : encodeDish(value as Dish);
    const result = await this.request(`${TABLES[kind]}${serverId ? `/${encodeURIComponent(serverId)}` : ''}`, serverId ? 'PUT' : 'POST', data);
    const decoded = kind === 'category' ? this.decode(result, decodeCategory) : this.decode(result, decodeDish);
    if (decoded.value.id !== value.id) throw new AppError('dataInvalid');
    return decoded;
  }
  async remove(kind: EntityKind, serverId: string) { await this.request(`${TABLES[kind]}/${encodeURIComponent(serverId)}`, 'DELETE'); }
}
