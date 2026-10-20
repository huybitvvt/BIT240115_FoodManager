import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppError } from '../domain/models';
import { isQuick } from '../domain/rules';
import { formatPrice } from '../i18n';
import { useApp } from './context';
import { Button, colors, ConfirmDialog, EmptyState, ErrorText, Photo, s } from './common';

export function DishDetail({ id }: { id: string }) {
  const { view, store, t, go, back } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dish = view.db.dishes.find(d => d.id === id);
  if (!dish) return <EmptyState title={t('notFound')} hint={t('notFoundHint')} />;
  const changeCover = async (index: number) => {
    setBusy(true); setError(null);
    try { await store.saveDish({ ...dish, images: dish.images.map((image, i) => ({ ...image, isThumbnail: index === i })) }, id); }
    catch (error) { setError(error instanceof AppError ? error.code : 'genericError'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try { await store.deleteDish(id); back(); }
    catch (error) { setError(error instanceof AppError ? error.code : 'genericError'); }
    finally { setBusy(false); setConfirm(false); }
  };
  return <ScrollView contentContainerStyle={s.content}>
    <Text accessibilityRole="header" style={s.title}>{t('details')}</Text>
    <View style={s.card}>
      <Text style={s.small}>{view.db.categories.find(c => c.id === dish.dishCategoryId)?.name}</Text><Text accessibilityRole="header" style={s.title}>{dish.name}</Text>
      <Text style={styles.price}>{formatPrice(dish.price, view.db.language)}</Text>
      <View style={s.wrap}>
        <View style={s.badge}><Text style={s.badgeText}>{t(isQuick(dish.preparationTime) ? 'quick' : 'regular')} · {dish.preparationTime} {t('minutes')}</Text></View>
        <View style={[s.badge, !dish.isAvailable && styles.unavailable]}><Text style={[s.badgeText, !dish.isAvailable && styles.unavailableText]}>{t(dish.isAvailable ? 'available' : 'unavailable')}</Text></View>
      </View>
      <Text style={s.label}>{t('description')}</Text><Text style={s.body}>{dish.description || '—'}</Text>
      <Text style={s.small}>{t('preparationTime')}: {dish.preparationTime}</Text>
    </View>
    <Text accessibilityRole="header" style={s.sectionTitle}>{t('photos')} · {dish.images.length}</Text>
    {dish.images.length === 0 ? <Photo large /> : dish.images.map((image, index) => <View key={`${index}_${image.imageUrl}`} style={s.card}>
      <Photo large url={image.imageUrl} label={`${dish.name} — ${t('imageNumber')} ${index + 1}`} />
      {image.isThumbnail ? <View style={s.badge}><Text style={s.badgeText}>{t('thumbnail')}</Text></View> : <Button label={t('makeThumbnail')} variant="secondary" icon="image-outline" disabled={busy} onPress={() => void changeCover(index)} />}
    </View>)}
    <ErrorText code={error} />
    <Button label={t('edit')} icon="create-outline" disabled={busy} onPress={() => go({ name: 'form', id })} />
    <Button label={t('delete')} variant="danger" icon="trash-outline" disabled={busy} onPress={() => setConfirm(true)} />
    <ConfirmDialog visible={confirm} title={t('deleteDishTitle')} message={t('deleteDishMessage')} busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => void remove()} />
  </ScrollView>;
}
const styles = StyleSheet.create({ price: { color: colors.primary, fontSize: 26, fontWeight: '700' }, unavailable: { backgroundColor: '#EEF0EE' }, unavailableText: { color: colors.muted } });
