import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

import { Capacitor } from '@capacitor/core';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// No service worker inside the native app. The bundle is already local, and a
// cache-first worker would keep serving the previous version's JS after an APK
// update. The web build keeps it for offline/PWA install.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err)));
}
