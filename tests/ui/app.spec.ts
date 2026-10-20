import { expect, Page, test } from '@playwright/test';

async function fakeMockApi(page: Page) {
  const data: Record<string, Record<string, unknown>[]> = { BIT240115_DishCategory: [], BIT240115_Dish: [] };
  let counter = 1;
  await page.route('https://bit240115-test.mockapi.io/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname.split('/').filter(Boolean);
    const resource = path[2], id = path[3]; const rows = data[resource];
    if (!rows) return route.fulfill({ status: 404, json: {} });
    if (request.method() === 'GET') return route.fulfill({ json: rows });
    if (request.method() === 'POST') { const row = { ...request.postDataJSON(), id: String(counter++) }; rows.push(row); return route.fulfill({ status: 201, json: row }); }
    const index = rows.findIndex(row => row.id === id);
    if (index < 0) return route.fulfill({ status: 404, json: {} });
    if (request.method() === 'PUT') { rows[index] = { ...request.postDataJSON(), id }; return route.fulfill({ json: rows[index] }); }
    if (request.method() === 'DELETE') return route.fulfill({ json: rows.splice(index, 1)[0] });
    return route.fulfill({ status: 405, json: {} });
  });
  await page.goto('/');
  await expect(page.getByText('All changes synced', { exact: false })).toBeVisible();
  return data;
}

test('lọc kết hợp, giữ bộ lọc khi quay lại và ngôn ngữ khi chuyển màn', async ({ page }) => {
  await fakeMockApi(page);
  await expect(page.getByRole('heading', { name: 'Dish catalog' })).toBeVisible();
  await page.getByRole('button', { name: 'Filters & sorting', exact: true }).click();
  await page.getByRole('button', { name: 'Starters', exact: true }).click();
  await page.getByRole('switch', { name: 'Available dishes only' }).check();
  await page.getByRole('textbox', { name: 'Min price (VND)' }).fill('30000');
  await page.getByRole('textbox', { name: 'Max price (VND)' }).fill('40000');
  await page.getByRole('textbox', { name: 'Search by dish name' }).fill('gỏi');
  await expect(page.getByText('1 dishes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gỏi cuốn', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chi tiết món ăn' })).toBeVisible();
  await page.getByRole('button', { name: 'Sửa món', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Tên món *', exact: true })).toHaveValue('Gỏi cuốn');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Tìm theo tên món' })).toHaveValue('gỏi');
  await expect(page.getByText('1 món ăn', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lọc và sắp xếp', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Giá cao nhất (VNĐ)' })).toHaveValue('40000');
  await page.getByRole('textbox', { name: 'Giá thấp nhất (VNĐ)' }).fill('50000');
  await expect(page.getByRole('alert')).toContainText('Giá không được âm');
});

test('validation, thêm/sửa/xóa, nhiều ảnh và ảnh đại diện', async ({ page }) => {
  const data = await fakeMockApi(page);
  await page.getByRole('button', { name: 'Add dish', exact: true }).click();
  await page.getByRole('button', { name: 'Save dish', exact: true }).click();
  await expect(page.getByText('Enter a dish name.', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Dish name *', exact: true }).fill('Món kiểm thử');
  await page.getByRole('textbox', { name: 'Price (VND) *', exact: true }).fill('50000');
  await page.getByRole('textbox', { name: 'Preparation time (minutes) *', exact: true }).fill('15');
  await page.getByRole('button', { name: 'Main dishes', exact: true }).click();
  await page.getByRole('textbox', { name: 'Image URL', exact: true }).fill('https://example.com/photo-a.jpg');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await page.getByRole('textbox', { name: 'Image URL', exact: true }).fill('https://example.com/photo-b.jpg');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await page.getByRole('button', { name: 'Save dish', exact: true }).click();
  await page.getByRole('button', { name: 'Món kiểm thử', exact: true }).click();
  await expect(page.getByText('Quick · 15 min', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Make cover', exact: true }).click();
  await expect.poll(() => {
    const dish = data.BIT240115_Dish.find(d => d.BIT240115_Name === 'Món kiểm thử');
    return (dish?.BIT240115_DishImage as { BIT240115_ImageUrl: string; BIT240115_IsThumbnail: boolean }[] | undefined)?.find(i => i.BIT240115_IsThumbnail)?.BIT240115_ImageUrl;
  }).toBe('https://example.com/photo-b.jpg');
  await page.getByRole('button', { name: 'Edit dish', exact: true }).click();
  await page.getByRole('textbox', { name: 'Price (VND) *', exact: true }).fill('62000');
  await page.getByRole('button', { name: 'Save dish', exact: true }).click();
  await expect(page.getByText('₫62,000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete dish', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dish details' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete dish', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dish catalog' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Món kiểm thử', exact: true })).toHaveCount(0);
  await expect.poll(() => data.BIT240115_Dish.some(d => d.BIT240115_Name === 'Món kiểm thử')).toBe(false);
});

test('tắt/bật mạng tự đồng bộ món tạo offline, không cần nút đồng bộ', async ({ page, context }) => {
  const data = await fakeMockApi(page);
  await context.setOffline(true);
  await expect(page.getByText('Offline ·', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Add dish', exact: true }).click();
  await page.getByRole('textbox', { name: 'Dish name *', exact: true }).fill('Món offline UI');
  await page.getByRole('textbox', { name: 'Price (VND) *', exact: true }).fill('61000');
  await page.getByRole('textbox', { name: 'Preparation time (minutes) *', exact: true }).fill('12');
  await page.getByRole('button', { name: 'Main dishes', exact: true }).click();
  await page.getByRole('button', { name: 'Save dish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Món offline UI', exact: true })).toBeVisible();
  expect(data.BIT240115_Dish.some(d => d.BIT240115_Name === 'Món offline UI')).toBe(false);
  await context.setOffline(false);
  await expect.poll(() => data.BIT240115_Dish.filter(d => d.BIT240115_Name === 'Món offline UI').length).toBe(1);
  await expect(page.getByText('All changes synced', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Món offline UI', exact: true })).toBeVisible();
  expect(data.BIT240115_Dish.filter(d => d.BIT240115_Name === 'Món offline UI')).toHaveLength(1);
});

test('ràng buộc loại đang dùng, layout màn nhỏ và ngang', async ({ page }) => {
  await fakeMockApi(page);
  await page.getByRole('button', { name: 'Dish categories', exact: true }).click();
  await page.getByRole('button', { name: 'Delete category', exact: true }).first().click();
  await expect(page.getByRole('alert')).toContainText('cannot be deleted');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  for (const viewport of [{ width: 375, height: 812 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Add dish', exact: true })).toBeVisible();
  }
  await page.screenshot({ path: 'artifacts/web-landscape.png', fullPage: true });
});

test('offline xóa rồi tạo lại cùng tên tự đồng bộ đúng một món', async ({ page, context }) => {
  const data = await fakeMockApi(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Phở bò', exact: true }).click();
  await page.getByRole('button', { name: 'Delete dish', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Add dish', exact: true }).click();
  await page.getByRole('textbox', { name: 'Dish name *', exact: true }).fill('Phở bò');
  await page.getByRole('textbox', { name: 'Price (VND) *', exact: true }).fill('72000');
  await page.getByRole('textbox', { name: 'Preparation time (minutes) *', exact: true }).fill('20');
  await page.getByRole('button', { name: 'Main dishes', exact: true }).click();
  await page.getByRole('button', { name: 'Save dish', exact: true }).click();
  await context.setOffline(false);
  await expect(page.getByText('All changes synced', { exact: false })).toBeVisible();
  const matches = data.BIT240115_Dish.filter(d => d.BIT240115_Name === 'Phở bò');
  expect(matches).toHaveLength(1);
  expect(matches[0].BIT240115_Price).toBe(72000);
});

test('Id không tồn tại ở chi tiết/chỉnh sửa có thông báo Anh–Việt', async ({ page }) => {
  await fakeMockApi(page);
  await page.goto('/dish/BIT240115_missing');
  await expect(page.getByRole('heading', { name: 'This dish or category no longer exists.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Món ăn hoặc loại món không còn tồn tại.', exact: true })).toBeVisible();
  await page.goto('/dish/BIT240115_missing/edit');
  await expect(page.getByRole('heading', { name: 'Món ăn hoặc loại món không còn tồn tại.', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tên món *', exact: true })).toHaveCount(0);
});
