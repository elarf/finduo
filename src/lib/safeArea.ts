import { Platform } from 'react-native';

export function topInset(base: number, nativeInset: number): any {
  if (Platform.OS === 'web') {
    return base === 0
      ? 'env(safe-area-inset-top, 0px)'
      : `calc(${base}px + env(safe-area-inset-top, 0px))`;
  }
  return base + nativeInset;
}

export function bottomInset(base: number, nativeInset: number): any {
  if (Platform.OS === 'web') {
    return base === 0
      ? 'env(safe-area-inset-bottom, 0px)'
      : `calc(${base}px + env(safe-area-inset-bottom, 0px))`;
  }
  return base + nativeInset;
}
