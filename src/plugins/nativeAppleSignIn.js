import { Capacitor, registerPlugin } from '@capacitor/core';

export const NativeAppleSignIn = registerPlugin('NativeAppleSignIn');

export const isNativeAppleSignInAvailable = () =>
  Capacitor.getPlatform?.() === 'ios' && Capacitor.isPluginAvailable('NativeAppleSignIn');
