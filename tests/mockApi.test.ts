import { afterEach, describe, expect, it, vi } from 'vitest';
import { TABLES } from '../src/config';
import { MockApi } from '../src/data/mockApi';
import { createSeed } from '../src/data/seed';
import { encodeCategory, encodeDish } from '../src/data/serialization';

const base = 'https://bit240115-test.mockapi.io/api/v1';
const db = createSeed();
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('REST MockAPI và xử lý lỗi', () => {
  it('GET đọc đủ hai resource và tách id hệ thống khỏi ID nghiệp vụ', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => response(url.endsWith(TABLES.category)
      ? db.categories.map((c, i) => ({ ...encodeCategory(c), id: String(i + 1) }))
      : db.dishes.map((d, i) => ({ ...encodeDish(d), id: String(i + 10) })))));
    const data = await new MockApi(base).read();
    expect(data.categories.map(r => r.value)).toEqual(db.categories);
    expect(data.dishes.map(r => r.value)).toEqual(db.dishes);
    expect(data.dishes[0].serverId).toBe('10');
    expect(data.dishes[0].value.id).toBe(db.dishes[0].id);
  });
  it('POST/PUT gửi toàn bộ field có MSSV_, bao gồm ảnh; không gửi id hệ thống', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => response({ ...JSON.parse(init.body as string), id: '42' }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new MockApi(base);
    await api.save('dish', db.dishes[0]);
    await api.save('dish', { ...db.dishes[0], price: 70000 }, '42');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][0]).toBe(`${base}/${TABLES.dish}/42`);
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(Object.keys(body).every(k => k.startsWith('BIT240115_'))).toBe(true);
    expect(body.BIT240115_DishImage[0]).toEqual({ BIT240115_ImageUrl: db.dishes[0].images[0].imageUrl, BIT240115_IsThumbnail: true });
    expect(body.id).toBeUndefined();
  });
  it('resource 404 báo cấu hình sai, không biến lỗi thành danh sách trống', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({}, 404)));
    await expect(new MockApi(base).read()).rejects.toThrow('apiResourceMissing');
  });
  it('DELETE record đã mất trên server coi như đã xóa', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({}, 404)));
    await expect(new MockApi(base).remove('dish', 'missing')).resolves.toBeUndefined();
  });
  it('HTTP 500 và mất kết nối báo lỗi API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({}, 500)));
    await expect(new MockApi(base).save('dish', db.dishes[0])).rejects.toThrow('apiError');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(new MockApi(base).read()).rejects.toThrow('apiError');
  });
  it('từ chối response sai schema hoặc sai ID nghiệp vụ', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ id: '1', name: 'unprefixed' })));
    await expect(new MockApi(base).save('dish', db.dishes[0])).rejects.toThrow('dataInvalid');
    vi.stubGlobal('fetch', vi.fn(async () => response({ ...encodeDish(db.dishes[0]), BIT240115_Id: 'wrong-id', id: '1' })));
    await expect(new MockApi(base).save('dish', db.dishes[0])).rejects.toThrow('dataInvalid');
  });
  it('URL rỗng/sai định dạng/sai dịch vụ được báo đúng lỗi', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    for (const url of ['', 'not a url', 'http://bit240115-test.mockapi.io', 'https://example.com']) {
      await expect(new MockApi(url).read()).rejects.toThrow('apiUrlInvalid');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('request quá 10 giây bị hủy và trả lỗi API', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })));
    const failure = expect(new MockApi(base).save('dish', db.dishes[0])).rejects.toThrow('apiError');
    await vi.advanceTimersByTimeAsync(10000);
    await failure;
  });
});
