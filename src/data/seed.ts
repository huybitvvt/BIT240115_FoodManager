import { Database } from '../domain/models';

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;
export function createSeed(): Database {
  const categories = [
    { id: 'BIT240115_category_main', name: 'Main dishes', description: 'Rice, noodles and other main dishes.' },
    { id: 'BIT240115_category_starter', name: 'Starters', description: 'Light dishes to start a meal.' },
    { id: 'BIT240115_category_dessert', name: 'Desserts', description: 'A sweet finish to your meal.' },
  ];
  const dishes = [
    { id: 'BIT240115_dish_pho', name: 'Phở bò', price: 65000, preparationTime: 20, isAvailable: true, description: 'Phở bò với nước dùng thanh, bánh phở và rau thơm.', dishCategoryId: categories[0].id,
      images: [{ imageUrl: photo('photo-1569718212165-3a8278d5f624'), isThumbnail: true }, { imageUrl: photo('photo-1547592180-85f173990554'), isThumbnail: false }] },
    { id: 'BIT240115_dish_rice', name: 'Cơm gà', price: 55000, preparationTime: 15, isAvailable: true, description: 'Cơm gà ăn kèm rau và nước chấm.', dishCategoryId: categories[0].id,
      images: [{ imageUrl: photo('photo-1547592180-85f173990554'), isThumbnail: true }] },
    { id: 'BIT240115_dish_rolls', name: 'Gỏi cuốn', price: 35000, preparationTime: 10, isAvailable: true, description: 'Gỏi cuốn tôm, rau xanh và bún tươi.', dishCategoryId: categories[1].id,
      images: [{ imageUrl: photo('photo-1512621776951-a57141f2eefd'), isThumbnail: true }] },
    { id: 'BIT240115_dish_salad', name: 'Salad rau', price: 45000, preparationTime: 8, isAvailable: false, description: 'Rau củ tươi trộn sốt chanh nhẹ.', dishCategoryId: categories[1].id,
      images: [{ imageUrl: photo('photo-1512621776951-a57141f2eefd'), isThumbnail: true }] },
    { id: 'BIT240115_dish_cake', name: 'Bánh kem dâu', price: 40000, preparationTime: 5, isAvailable: true, description: 'Bánh kem mềm với dâu tươi.', dishCategoryId: categories[2].id,
      images: [{ imageUrl: photo('photo-1464305795204-6f5bbfc7fb81'), isThumbnail: true }] },
  ];
  return { categories, dishes, language: 'en', pending: [
    ...categories.map(c => ({ kind: 'category' as const, id: c.id, action: 'upsert' as const, revision: `seed_${c.id}` })),
    ...dishes.map(d => ({ kind: 'dish' as const, id: d.id, action: 'upsert' as const, revision: `seed_${d.id}` })),
  ] };
}
