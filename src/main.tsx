import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { ToastProvider } from './components/Toast';
import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

// 新版本发布后自动刷新：
// 页面此前已被 SW 控制时，新 SW 激活接管（controllerchange）即自动 reload，
// 用户不需要手动强刷就能拿到最新版本。
let refreshing = false;
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
