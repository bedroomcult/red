import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.red.tracker',
  appName: 'Red',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    // Capacitor 7 defaults this to 'disable', which leaves the WebView drawing
    // under the system status bar on Android 15 (edge-to-edge is forced there).
    // 'auto' insets the WebView when the platform is edge-to-edge, so content
    // starts below the status bar. env(safe-area-inset-*) is 0 in the Android
    // WebView, so the CSS alone could not fix this.
    // ponytail: 'auto', not 'force' — on pre-Android-15 it stays a no-op.
    adjustMarginsForEdgeToEdge: 'auto'
  },
  plugins: {
    StatusBar: {
      // Capacitor's style enum names the BACKGROUND, not the icon: 'DARK' means
      // "light text for dark backgrounds". The app boots light, so the cold-boot
      // value must be 'LIGHT' (dark icons on the light bar). Getting this
      // backwards is what left white icons on a near-white bar.
      // The runtime sync in src/theme.ts corrects this on the first paint, and
      // tracks every later theme change.
      style: 'LIGHT',
      // The WebView is inset by adjustMarginsForEdgeToEdge, so the bar must not
      // overlay it, or the inset and the overlay cancel out.
      overlaysWebView: false
    }
  }
};

export default config;
