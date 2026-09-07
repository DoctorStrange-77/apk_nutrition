import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'builder-nutrition:pwa-install-dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function PwaInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const ios = isIos();

  useEffect(() => {
    if (Capacitor.isNativePlatform() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    setVisible(true);

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    if (result.outcome === 'accepted') setVisible(false);
    setPromptEvent(null);
  };

  return <section className="pwa-install-banner">
    <div>
      <p className="eyebrow red">VERSIONE WEB</p>
      <strong>Usa App Nutrition come un app</strong>
      <span>{ios
        ? 'Su iPhone: apri Condividi e scegli Aggiungi alla schermata Home.'
        : 'Installa App Nutrition sulla schermata Home per aprirla a tutto schermo.'}</span>
    </div>
    <div className="pwa-install-actions">
      {!ios && promptEvent && <button className="primary small" onClick={() => void install()}>Installa</button>}
      <button className="secondary small" onClick={dismiss}>{ios ? 'Ho capito' : 'Non ora'}</button>
    </div>
  </section>;
}
