import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppError } from '../domain/models';
import { assertCategoryUnused } from '../domain/rules';
import { useApp } from './context';
import { Button, ConfirmDialog, EmptyState, ErrorText, s } from './common';

export function Categories() {
  const { view, store, t } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const askDelete = (id: string) => {
    setError(null);
    try { assertCategoryUnused(id, view.db.dishes); setSelected(id); }
    catch (error) { setError(error instanceof AppError ? error.code : 'genericError'); }
  };
  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    try { await store.deleteCategory(selected); }
    catch (error) { setError(error instanceof AppError ? error.code : 'genericError'); }
    finally { setSelected(null); setBusy(false); }
  };
  return <ScrollView contentContainerStyle={s.content}>
    <Text accessibilityRole="header" style={s.title}>{t('categories')}</Text>
    <Text style={s.body}>{t('categoryHint')}</Text><ErrorText code={error} />
    {view.db.categories.map(category => <View key={category.id} style={s.card}>
      <Text style={s.sectionTitle}>{category.name}</Text><Text style={s.body}>{category.description || '—'}</Text>
      <Text style={s.small}>{view.db.dishes.filter(d => d.dishCategoryId === category.id).length} {t('results')}</Text>
      <Button label={t('deleteCategory')} icon="trash-outline" variant="danger" disabled={busy} onPress={() => askDelete(category.id)} />
    </View>)}
    {!view.db.categories.length && <EmptyState title={t('noCategories')} icon="grid-outline" />}
    <ConfirmDialog visible={!!selected} title={t('deleteCategoryTitle')} message={t('deleteCategoryMessage')} busy={busy} onCancel={() => setSelected(null)} onConfirm={() => void remove()} />
  </ScrollView>;
}
