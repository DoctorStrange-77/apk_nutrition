import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { AppModal } from '@/components/AppModal';
import { isValidBarcode } from '@/services/barcodeService';

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
};

const cameraErrorMessage = (error: unknown) => {
  const text = String(error);
  if (text.includes('NotAllowedError') || text.includes('Permission')) {
    return 'Consenti l accesso alla fotocamera nelle impostazioni del browser.';
  }
  if (text.includes('NotFoundError') || text.includes('DevicesNotFoundError')) {
    return 'Nessuna fotocamera disponibile su questo dispositivo.';
  }
  if (!window.isSecureContext) {
    return 'Lo scanner richiede una connessione HTTPS sicura.';
  }
  return 'Impossibile avviare la fotocamera. Puoi inserire il barcode manualmente.';
};

export function WebBarcodeScannerModal({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [message, setMessage] = useState('Inquadra il codice a barre del prodotto.');

  useEffect(() => {
    if (!open) return;
    detectedRef.current = false;
    setMessage('Inquadra il codice a barre del prodotto.');
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('CAMERA_API_UNAVAILABLE');
        }
        const video = videoRef.current;
        if (!video) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video,
          (result) => {
            if (!result || detectedRef.current || cancelled) return;
            const value = result.getText().trim();
            if (!isValidBarcode(value)) return;
            detectedRef.current = true;
            controlsRef.current?.stop();
            onDetectedRef.current(value);
          },
        );
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch (error) {
        if (!cancelled) setMessage(cameraErrorMessage(error));
      }
    };

    void start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open]);

  return (
    <AppModal open={open} title="Scansiona barcode" eyebrow="FOTOCAMERA" onClose={onClose}>
      <div className="web-barcode-scanner">
        <div className="web-barcode-frame">
          <video ref={videoRef} muted playsInline autoPlay />
          <span className="web-barcode-guide" />
        </div>
        <p className="muted">{message}</p>
        <button className="secondary" type="button" onClick={onClose}>Chiudi scanner</button>
      </div>
    </AppModal>
  );
}
