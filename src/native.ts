import { Capacitor } from '@capacitor/core';

// Thin wrapper so components do not import the Capacitor runtime directly.
export const isNative = (): boolean => Capacitor.isNativePlatform();
