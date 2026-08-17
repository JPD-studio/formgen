'use client';
import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // 開発サーバーでは登録しない。SW のキャッシュ優先戦略が
    // next dev のホットリロードと衝突し、古いバンドルを配信し続けてしまうため
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch((err) => console.error('SW registration failed:', err));
    }
  }, []);
  return null;
}
