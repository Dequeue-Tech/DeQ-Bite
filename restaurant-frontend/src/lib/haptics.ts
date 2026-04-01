const HAPTICS_STORAGE_KEY = 'customer_vibration_feedback';

export type HapticPattern =
  | 'navigation'
  | 'tab_switch'
  | 'primary_action'
  | 'order_confirmed'
  | 'status_update'
  | 'order_delivered'
  | 'error';

const patternMap: Record<HapticPattern, number | number[]> = {
  navigation: [30],
  tab_switch: [20],
  primary_action: [40],
  order_confirmed: [100],
  status_update: [50, 30, 50],
  order_delivered: [200, 100, 200],
  error: [80, 40, 80],
};

export const isHapticsEnabled = () => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(HAPTICS_STORAGE_KEY);
  if (!stored) return true;
  return stored !== 'off';
};

export const setHapticsEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? 'on' : 'off');
};

export const triggerHaptic = (pattern: HapticPattern) => {
  if (typeof window === 'undefined') return;
  if (!isHapticsEnabled()) return;
  if (!('navigator' in window) || typeof window.navigator.vibrate !== 'function') return;
  window.navigator.vibrate(patternMap[pattern]);
};

export const HAPTICS_STORAGE = {
  KEY: HAPTICS_STORAGE_KEY,
};
