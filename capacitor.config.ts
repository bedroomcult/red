import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.red.tracker',
  appName: 'Red',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    // Android 15 enforces edge-to-edge: the status bar is transparent and
    // setStatusBarColor is a no-op. With the WebView inset ('auto'), the strip
    // behind the bar is the Android theme's default white window background, so
    // the bar always read white regardless of the app theme.
    //
    // 'disable' lets the WebView draw under the bar instead, so the app's own
    // --bg fills it and the bar colour tracks the theme. The content is padded
    // by env(safe-area-inset-top) in index.css.
    adjustMarginsForEdgeToEdge: 'disable'
  },
  plugins: {
    StatusBar: {
      // Draw under the bar so the app background is the bar background.
      overlaysWebView: true,
      // Capacitor's style enum names the BACKGROUND, not the icon: 'LIGHT' means
      // "dark text for light backgrounds". The app boots light, so the cold-boot
      // value is 'LIGHT' (dark icons). src/theme.ts corrects this on first paint
      // and tracks every later theme change.
      style: 'LIGHT'
    }
  }
};

export default config;
