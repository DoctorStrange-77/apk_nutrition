import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

const BARCODE_PATTERN = /^[0-9]{8,14}$/;

export const isValidBarcode = (value: string) => BARCODE_PATTERN.test(value.trim());

export async function scanProductBarcode(): Promise<string> {
  if (Capacitor.getPlatform() === 'web') throw new Error('SCANNER_NATIVE_ONLY');

  if (Capacitor.getPlatform() === 'android') {
    const module = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!module.available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
      throw new Error('SCANNER_MODULE_INSTALLING');
    }
  }

  const result = await BarcodeScanner.scan();
  const first = result.barcodes?.[0] as { rawValue?: string; displayValue?: string } | undefined;
  const value = (first?.rawValue || first?.displayValue || '').trim();
  if (!isValidBarcode(value)) throw new Error('INVALID_OR_MISSING_BARCODE');
  return value;
}
