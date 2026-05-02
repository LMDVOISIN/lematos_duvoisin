import { Capacitor, registerPlugin } from '@capacitor/core';

export const NativeAppleSignIn = registerPlugin('NativeAppleSignIn');

export const isNativeAppleSignInAvailable = async () => {
  if (Capacitor.getPlatform?.() !== 'ios') return false;

  try {
    if (typeof NativeAppleSignIn?.isAvailable === 'function') {
      const result = await NativeAppleSignIn.isAvailable();
      if (typeof result?.available === 'boolean') {
        return result.available;
      }
    }
  } catch (_error) {
    // Some manually-registered native plugins are callable even when
    // Capacitor's static availability metadata is incomplete.
  }

  return true;
};
