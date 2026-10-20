import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, TextInputInstance, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from './context';

export const colors = { primary: '#174C3C', primaryLight: '#E8F0E9', background: '#F6F7F3', surface: '#FFFFFF', text: '#202F29', muted: '#52635A', border: '#DCE3DB', danger: '#B42318', dangerLight: '#FDF0EE', amber: '#805000', amberLight: '#FFF2D8' };
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, color = colors.muted, size = 20 }: { name: IconName; color?: string; size?: number }) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}
export function Button({ label, onPress, icon, variant = 'primary', disabled = false, busy = false }: {
  label: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; busy?: boolean;
}) {
  const color = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? colors.danger : colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [s.button, variant === 'primary' ? s.primaryButton : variant === 'danger' ? s.dangerButton : s.secondaryButton, (disabled || busy) && s.disabled, pressed && s.pressed]}>
    {busy ? <ActivityIndicator color={color} /> : icon && <Icon name={icon} color={color} />}
    <Text style={[s.buttonText, { color }]}>{label}</Text>
  </Pressable>;
}
export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [s.choice, selected && s.choiceSelected, pressed && s.pressed]}>
    <Text style={[s.choiceText, selected && s.choiceSelectedText]}>{label}</Text>
  </Pressable>;
}
export function ErrorText({ code }: { code?: string | null }) {
  const { t } = useApp();
  return code ? <Text accessibilityRole="alert" style={s.error}>{t(code)}</Text> : null;
}
export function Field({ label, error, inputRef, ...props }: TextInputProps & { label: string; error?: string; inputRef?: React.Ref<TextInputInstance> }) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={[s.input, props.multiline && s.multiline, !!error && s.inputError, props.style]} />
    <ErrorText code={error} />
  </View>;
}
type PhotoProps = { url?: string; label?: string; large?: boolean };
export function Photo(props: PhotoProps) {
  return <PhotoContent key={props.url ?? ''} {...props} />;
}
function PhotoContent({ url, label, large = false }: PhotoProps) {
  const { t } = useApp();
  const [failed, setFailed] = useState(false);
  return url && !failed ? <Image source={{ uri: url }} accessibilityLabel={label} accessible resizeMode="cover" onError={() => setFailed(true)} style={large ? s.photoLarge : s.photo} /> :
    <View style={[large ? s.photoLarge : s.photo, s.photoPlaceholder]} accessibilityLabel={url ? t('imageFailed') : t('noPhoto')}>
      <Icon name="image-outline" size={large ? 32 : 24} /><Text style={s.photoCaption}>{url ? t('imageFailed') : t('noPhoto')}</Text>
    </View>;
}
export function ConfirmDialog({ visible, title, message, busy, onCancel, onConfirm }: { visible: boolean; title: string; message: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useApp();
  return <Modal visible={visible} transparent animationType="none" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={s.scrim} accessibilityViewIsModal><View style={s.dialog}>
      <View style={s.dialogIcon}><Icon name="trash-outline" color={colors.danger} size={26} /></View>
      <Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>
      <Text style={s.body}>{message}</Text>
      <View style={s.row}><Button label={t('cancel')} variant="secondary" disabled={busy} onPress={onCancel} /><Button label={t('confirmDelete')} variant="danger" busy={busy} onPress={onConfirm} /></View>
    </View></View>
  </Modal>;
}
export function EmptyState({ title, hint, icon = 'restaurant-outline' }: { title: string; hint?: string; icon?: IconName }) {
  return <View style={s.empty}><Icon name={icon} size={40} /><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>{hint && <Text style={[s.body, s.center]}>{hint}</Text>}</View>;
}
export const s = StyleSheet.create({
  fill: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, gap: 20, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.8 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: colors.text }, body: { fontSize: 14, lineHeight: 22, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text }, small: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, gap: 12 },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { fontSize: 14, fontWeight: '600', flexShrink: 1 }, primaryButton: { backgroundColor: colors.primary }, secondaryButton: { backgroundColor: colors.primaryLight }, dangerButton: { backgroundColor: colors.dangerLight },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.45 }, field: { gap: 7 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 104, textAlignVertical: 'top' }, inputError: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  choice: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary }, choiceText: { color: colors.muted, fontSize: 13, fontWeight: '500' }, choiceSelectedText: { color: '#FFFFFF' },
  photo: { width: 92, height: 100, borderRadius: 12, backgroundColor: colors.primaryLight }, photoLarge: { width: '100%', height: 200, borderRadius: 14, backgroundColor: colors.primaryLight },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 8, gap: 6 }, photoCaption: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  empty: { padding: 32, alignItems: 'center', gap: 14 }, center: { textAlign: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: colors.primaryLight }, badgeText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  scrim: { flex: 1, backgroundColor: 'rgba(14, 28, 21, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 }, dialog: { backgroundColor: colors.surface, padding: 24, borderRadius: 22, gap: 18, width: '100%', maxWidth: 420 }, dialogIcon: { alignSelf: 'flex-start', padding: 12, borderRadius: 16, backgroundColor: colors.dangerLight },
});
