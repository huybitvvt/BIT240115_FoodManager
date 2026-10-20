import { useRef, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, ScrollViewInstance, Switch, Text, TextInputInstance, View } from 'react-native';
import { AppError, DishDraft, DishImage } from '../domain/models';
import { isImageUrl, validateDish } from '../domain/rules';
import { useApp } from './context';
import { Button, Choice, colors, EmptyState, ErrorText, Field, Photo, s } from './common';

export function DishForm({ id }: { id?: string }) {
  const { view, store, t, back } = useApp();
  const original = view.db.dishes.find(d => d.id === id);
  const [name, setName] = useState(original?.name ?? '');
  const [price, setPrice] = useState(original ? String(original.price) : '');
  const [time, setTime] = useState(original ? String(original.preparationTime) : '');
  const [description, setDescription] = useState(original?.description ?? '');
  const [categoryId, setCategoryId] = useState(original?.dishCategoryId ?? '');
  const [available, setAvailable] = useState(original?.isAvailable ?? true);
  const [images, setImages] = useState<DishImage[]>(original?.images.map(i => ({ ...i })) ?? []);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const inputs = useRef<Record<string, TextInputInstance | null>>({});
  if (id && !original) return <EmptyState title={t('notFound')} hint={t('notFoundHint')} />;
  const clearError = (key: string) => setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
  const addImage = () => {
    if (!isImageUrl(imageUrl.trim())) { setImageError('imageUrlInvalid'); return; }
    setImages([...images, { imageUrl: imageUrl.trim(), isThumbnail: images.length === 0 }]);
    setImageUrl(''); setImageError(null); clearError('images');
  };
  const save = async () => {
    setError(null); setImageError(null);
    const finalImages = imageUrl.trim() ? [...images, { imageUrl: imageUrl.trim(), isThumbnail: images.length === 0 }] : images;
    const draft: DishDraft = { name, price: Number(price), preparationTime: Number(time), description, dishCategoryId: categoryId, isAvailable: available, images: finalImages };
    const validation = validateDish(draft, view.db.categories, view.db.dishes, id);
    setErrors(validation);
    if (Object.keys(validation).length) {
      scroll.current?.scrollTo({ y: 0, animated: false });
      inputs.current[Object.keys(validation)[0]]?.focus();
      AccessibilityInfo.announceForAccessibility(t('validationSummary'));
      return;
    }
    setBusy(true);
    try { await store.saveDish(draft, id); back(); }
    catch (error) { setError(error instanceof AppError ? error.code : 'genericError'); }
    finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>{t(id ? 'editDish' : 'addDish')}</Text>
      {Object.keys(errors).length > 0 && <ErrorText code="validationSummary" />}
      <View style={s.card}>
        <Field inputRef={input => { inputs.current.name = input; }} label={`${t('name')} *`} value={name} onChangeText={text => { setName(text); clearError('name'); }} placeholder={t('namePlaceholder')} error={errors.name} editable={!busy} />
        <Field inputRef={input => { inputs.current.price = input; }} label={`${t('price')} *`} value={price} onChangeText={text => { setPrice(text); clearError('price'); }} placeholder="65000" keyboardType="decimal-pad" error={errors.price} editable={!busy} />
        <Field inputRef={input => { inputs.current.preparationTime = input; }} label={`${t('preparationTime')} *`} value={time} onChangeText={text => { setTime(text); clearError('preparationTime'); }} placeholder="15" keyboardType="decimal-pad" error={errors.preparationTime} editable={!busy} />
        <Text style={s.label}>{t('category')} *</Text>
        <View style={s.wrap}>{view.db.categories.map(c => <Choice key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => { if (!busy) { setCategoryId(c.id); clearError('dishCategoryId'); } }} />)}</View>
        {!view.db.categories.length && <Text style={s.body}>{t('noCategories')}</Text>}
        <ErrorText code={errors.dishCategoryId} />
        <Field label={t('description')} value={description} onChangeText={setDescription} placeholder={t('descriptionPlaceholder')} multiline editable={!busy} />
        <View style={s.between}><Text style={s.label}>{t('available')}</Text><Switch accessibilityLabel={t('available')} value={available} onValueChange={setAvailable} disabled={busy} trackColor={{ true: colors.primary }} /></View>
        <Text style={s.small}>{t('availabilityHint')}</Text>
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.sectionTitle}>{t('photos')}</Text><Text style={s.body}>{t('photoHint')}</Text>
        <Field label={t('imageUrl')} value={imageUrl} onChangeText={text => { setImageUrl(text); setImageError(null); clearError('images'); }} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" error={imageError ?? errors.images} editable={!busy} />
        <Button label={t('addImage')} variant="secondary" icon="add" onPress={addImage} disabled={busy} />
        {images.length === 0 && <Text style={s.small}>{t('noPhoto')}</Text>}
        {images.map((image, index) => <View key={`${index}_${image.imageUrl}`} style={{ gap: 10, marginTop: 8 }}>
          <Photo large url={image.imageUrl} label={`${t('imageNumber')} ${index + 1}`} />
          <View style={s.wrap}>
            {image.isThumbnail ? <View style={s.badge}><Text style={s.badgeText}>{t('thumbnail')}</Text></View> : <Button label={t('makeThumbnail')} variant="secondary" disabled={busy} onPress={() => setImages(images.map((item, i) => ({ ...item, isThumbnail: i === index })))} />}
            <Button label={t('removeImage')} variant="danger" icon="trash-outline" disabled={busy} onPress={() => setImages(images.filter((_, i) => i !== index))} />
          </View>
        </View>)}
      </View>
      <ErrorText code={error} />
      <Button label={t(busy ? 'saving' : 'save')} icon="checkmark" busy={busy} onPress={() => void save()} />
      <Button label={t('cancel')} variant="secondary" disabled={busy} onPress={back} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
