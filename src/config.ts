// Bài giữa kỳ: BIT240115 — Nguyễn Doãn Huy.
export const STUDENT_ID = 'BIT240115';
export const STUDENT_NAME = 'Nguyễn Doãn Huy';
export const PROJECT_NAME = 'BIT240115_FoodManager';
export const TABLES = {
  category: 'BIT240115_DishCategory',
  dish: 'BIT240115_Dish',
} as const;
export const DATABASE_KEY = 'BIT240115_Database';
export const API_URL = (process.env.EXPO_PUBLIC_MOCKAPI_URL ?? '').trim().replace(/\/+$/, '');
