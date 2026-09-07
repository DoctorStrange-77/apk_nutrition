import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { BetaAccessGate } from './components/BetaAccessGate';
import './styles.css';
import './styles-v07.css';
import './styles-v07-calendar.css';
import './styles-v08.css';
import './styles-v09.css';
import './styles-v10.css';
import './styles-v101.css';
import './styles-v102.css';
import './styles-v104.css';
import './styles-v110.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BetaAccessGate><App /></BetaAccessGate>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    void navigator.serviceWorker.register('/sw.js').then(() => {
      if (!hadController) return;
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }).catch(() => {
      // Browser version remains usable without service worker support.
    });
  });
}
