import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { API_URL } from './config';
import { MockApi } from './data/mockApi';
import { FoodStore } from './data/store';

export const store = new FoodStore(AsyncStorage, API_URL ? new MockApi(API_URL) : undefined);
export function startRuntime() {
  let stopped = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const autoSync = () => {
    if (stopped || AppState.currentState === 'background') return;
    void store.synchronize();
  };
  const unsubscribeNetwork = NetInfo.addEventListener(state => {
    const connected = state.isConnected === true && state.isInternetReachable !== false;
    store.setConnected(connected);
    if (connected) autoSync();
  });
  const unsubscribeStore = store.subscribe(() => {
    const view = store.getSnapshot();
    if (debounce) clearTimeout(debounce);
    if (view.ready && view.connected && view.configured && !view.syncing && !view.syncError && view.db.pending.length) {
      debounce = setTimeout(autoSync, 350);
    }
  });
  const appState = AppState.addEventListener('change', state => { if (state === 'active') { void NetInfo.refresh(); autoSync(); } });
  // Thử lại tự động khi server lỗi tạm thời, đồng thời nhận thay đổi từ server.
  const retry = setInterval(autoSync, 15000);
  void store.initialize().then(autoSync);
  return () => { stopped = true; if (debounce) clearTimeout(debounce); clearInterval(retry); unsubscribeNetwork(); unsubscribeStore(); appState.remove(); };
}
