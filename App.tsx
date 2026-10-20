import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Slot, usePathname } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PROJECT_NAME, STUDENT_ID, STUDENT_NAME } from './src/config';
import { AppError, DEFAULT_FILTERS, DishFilters } from './src/domain/models';
import { translate } from './src/i18n';
import { startRuntime, store } from './src/runtime';
import { AppContext, Screen } from './src/ui/context';
import { Button, colors, ErrorText, Icon, s } from './src/ui/common';

export default function App() {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const pathname = usePathname();
  const [filters, setFilters] = useState<DishFilters>({ ...DEFAULT_FILTERS });
  const [error, setError] = useState<string | null>(null);
  const t = (key: string) => translate(view.db.language, key);
  const back = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/'); }, []);
  const go = useCallback((next: Screen) => {
    if (next.name === 'list') router.push('/');
    else if (next.name === 'categories') router.push('/categories');
    else if (next.name === 'detail') router.push({ pathname: '/dish/[id]', params: { id: next.id } });
    else if (next.id) router.push({ pathname: '/dish/[id]/edit', params: { id: next.id } });
    else router.push('/dish/new');
  }, []);
  useEffect(startRuntime, []);
  const changeLanguage = async (language: 'en' | 'vi') => {
    setError(null);
    try { await store.setLanguage(language); }
    catch (error) { setError(error instanceof AppError ? error.code : 'genericError'); }
  };
  return <SafeAreaProvider><StatusBar style="dark" />
    <AppContext.Provider value={{ store, view, go, back, filters, setFilters }}>
      <SafeAreaView style={s.screen}><View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.identity}><View style={styles.brandIcon}><Icon name="restaurant-outline" color={colors.primary} size={24} /></View><View style={s.fill}>
            <Text style={styles.project}>{PROJECT_NAME}</Text><Text style={styles.student}>{STUDENT_NAME} · {STUDENT_ID}</Text>
          </View></View>
          {view.ready && <View accessibilityLabel={t('language')} style={styles.languages}>{(['en', 'vi'] as const).map(language => <Pressable key={language} accessibilityRole="button" accessibilityLabel={t(language === 'en' ? 'english' : 'vietnamese')} accessibilityState={{ selected: view.db.language === language }} onPress={() => void changeLanguage(language)} style={({ pressed }) => [styles.language, language === view.db.language && styles.languageActive, pressed && s.pressed]}><Text style={[styles.languageText, language === view.db.language && styles.languageActiveText]}>{language.toUpperCase()}</Text></Pressable>)}</View>}
        </View>
        {view.ready && <View style={styles.connection} accessibilityLiveRegion="polite">
          <Icon name={!view.connected ? 'cloud-offline-outline' : view.syncing ? 'cloud-upload-outline' : 'cloud-done-outline'} size={17} color={view.syncError ? colors.danger : colors.primary} />
          <Text style={styles.connectionText}>{!view.connected ? t('offline') : t('online')} · {view.syncing ? t('syncing') : view.db.pending.length ? `${view.db.pending.length} ${t('pending')}` : view.configured ? t('synced') : t('savedLocally')}</Text>
        </View>}
        {view.ready && !view.configured && <Text style={styles.notice}>{t('apiNotConfigured')}</Text>}
        {view.syncError && <View style={styles.errorNotice}><ErrorText code={view.syncError} /><Text style={s.small}>{t('syncRetry')}</Text></View>}
        {error && <View style={styles.errorNotice}><ErrorText code={error} /></View>}
        {pathname !== '/' && <View style={styles.backRow}><Button label={t('back')} variant="secondary" icon="arrow-back" onPress={back} /></View>}
        {!view.ready ? <View style={[s.fill, styles.loading]}>{view.loadError ? <><ErrorText code={view.loadError} /><Button label={t('retry')} onPress={() => void store.initialize()} /></> : <><ActivityIndicator size="large" color={colors.primary} /><Text style={s.body}>{t('loading')}</Text></>}</View> :
          <Slot />}
      </View></SafeAreaView>
    </AppContext.Provider>
  </SafeAreaProvider>;
}
const styles = StyleSheet.create({
  shell: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }, header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }, brandIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primaryLight },
  project: { fontSize: 12, fontWeight: '700', color: colors.text }, student: { fontSize: 10, lineHeight: 16, color: colors.muted },
  languages: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 10 }, language: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, languageActive: { backgroundColor: colors.primary }, languageText: { fontSize: 12, color: colors.muted, fontWeight: '700' }, languageActiveText: { color: '#FFFFFF' },
  connection: { paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primaryLight }, connectionText: { color: colors.primary, fontSize: 11, lineHeight: 17, flex: 1 },
  notice: { color: colors.amber, backgroundColor: colors.amberLight, fontSize: 11, lineHeight: 17, paddingHorizontal: 20, paddingVertical: 8 },
  errorNotice: { backgroundColor: colors.dangerLight, paddingHorizontal: 20, paddingVertical: 10, gap: 4 }, backRow: { paddingHorizontal: 20, paddingTop: 12, alignItems: 'flex-start' }, loading: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
});
