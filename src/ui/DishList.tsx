import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { DEFAULT_FILTERS, Dish, DishFilters } from '../domain/models';
import { filterDishes, isQuick, priceRangeError } from '../domain/rules';
import { formatPrice } from '../i18n';
import { useApp } from './context';
import { Button, Choice, colors, EmptyState, ErrorText, Field, Icon, Photo, s } from './common';

export function DishList({ filters, setFilters }: { filters: DishFilters; setFilters: (f: DishFilters) => void }) {
  const { t, view, go } = useApp();
  const [expanded, setExpanded] = useState(false);
  const set = (patch: Partial<DishFilters>) => setFilters({ ...filters, ...patch });
  const rangeError = priceRangeError(filters);
  const rows = filterDishes(view.db.dishes, filters);
  const renderDish = ({ item: dish }: { item: Dish }) => {
    const cover = dish.images.find(i => i.isThumbnail) ?? dish.images[0];
    return <Pressable accessibilityRole="button" accessibilityLabel={dish.name} onPress={() => go({ name: 'detail', id: dish.id })} style={({ pressed }) => [s.card, styles.dishCard, pressed && s.pressed]}>
      <Photo url={cover?.imageUrl} label={dish.name} />
      <View style={[s.fill, styles.dishInfo]}>
        <Text style={s.small}>{view.db.categories.find(c => c.id === dish.dishCategoryId)?.name}</Text>
        <Text style={styles.dishName}>{dish.name}</Text>
        <Text style={styles.price}>{formatPrice(dish.price, view.db.language)}</Text>
        <View style={s.wrap}>
          <View style={s.badge}><Text style={s.badgeText}>{t(isQuick(dish.preparationTime) ? 'quick' : 'regular')} · {dish.preparationTime} {t('minutes')}</Text></View>
          <Text style={[styles.availability, !dish.isAvailable && styles.unavailable]}>{t(dish.isAvailable ? 'available' : 'unavailable')}</Text>
        </View>
      </View><Icon name="chevron-forward" size={16} />
    </Pressable>;
  };
  return <FlatList data={rows} keyExtractor={d => d.id} renderItem={renderDish} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<View style={styles.header}>
      <View style={s.between}><Text accessibilityRole="header" style={[s.title, s.fill]}>{t('catalog')}</Text><Button label={t('addDish')} icon="add" onPress={() => go({ name: 'form' })} /></View>
      <Text style={s.body}>{t('catalogHint')}</Text>
      <Field label={t('search')} value={filters.search} onChangeText={search => set({ search })} placeholder={t('search')} returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        <Choice label={t('allCategories')} selected={!filters.categoryId} onPress={() => set({ categoryId: '' })} />
        {view.db.categories.map(c => <Choice key={c.id} label={c.name} selected={filters.categoryId === c.id} onPress={() => set({ categoryId: c.id })} />)}
      </ScrollView>
      <View style={s.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('filters')} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={[s.between, styles.filterToggle]}>
          <View style={s.row}><Icon name="options-outline" color={colors.primary} /><Text style={s.label}>{t('filters')}</Text></View><Icon name={expanded ? 'chevron-up' : 'chevron-down'} />
        </Pressable>
        {expanded && <View style={styles.filterFields}>
          <View style={s.between}><Text style={[s.body, s.fill]}>{t('availableOnly')}</Text><Switch accessibilityLabel={t('availableOnly')} value={filters.availableOnly} onValueChange={availableOnly => set({ availableOnly })} trackColor={{ true: colors.primary }} /></View>
          <View style={styles.priceFields}>
            <View style={s.fill}><Field label={t('minPrice')} value={filters.minPrice} onChangeText={minPrice => set({ minPrice })} keyboardType="decimal-pad" placeholder="0" /></View>
            <View style={s.fill}><Field label={t('maxPrice')} value={filters.maxPrice} onChangeText={maxPrice => set({ maxPrice })} keyboardType="decimal-pad" placeholder="—" /></View>
          </View>
          <Text style={s.label}>{t('sort')}</Text><View style={s.wrap}>{(['priceAsc', 'priceDesc', 'timeAsc'] as const).map(sort => <Choice key={sort} label={t(sort)} selected={filters.sort === sort} onPress={() => set({ sort })} />)}</View>
          <Button label={t('resetFilters')} variant="secondary" icon="refresh-outline" onPress={() => setFilters({ ...DEFAULT_FILTERS })} />
        </View>}
        <ErrorText code={rangeError} />
      </View>
      <View style={s.between}><Text style={s.label}>{rows.length} {t('results')}</Text><Button label={t('categories')} variant="secondary" icon="grid-outline" onPress={() => go({ name: 'categories' })} /></View>
    </View>}
    ListEmptyComponent={!rangeError ? <EmptyState title={t('empty')} hint={t('emptyHint')} /> : undefined} />;
}
const styles = StyleSheet.create({
  header: { gap: 16, marginBottom: 20 }, dishCard: { flexDirection: 'row', alignItems: 'center' }, dishInfo: { gap: 6 },
  dishName: { fontSize: 17, fontWeight: '700', color: colors.text }, price: { fontSize: 16, fontWeight: '700', color: colors.primary },
  availability: { color: colors.primary, fontSize: 11, paddingVertical: 4 }, unavailable: { color: colors.muted },
  filterToggle: { minHeight: 48 }, filterFields: { gap: 16, paddingTop: 4 }, priceFields: { flexDirection: 'row', gap: 12 },
});
