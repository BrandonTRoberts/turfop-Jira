import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function QRScanner({ onScan, onClose, title = "Scan QR Code" }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // We create the scanner instance
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        // Stop scanning after a successful read
        scanner.clear();
        onScan(decodedText);
      },
      (err) => {
        // We can just log errors to console or ignore them (happens a lot while searching for a QR)
        // console.warn(err);
      }
    );

    scannerRef.current = scanner;

    // Cleanup on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border shadow-lg rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 flex flex-col items-center">
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Position the QR code inside the camera frame.
          </p>
          <div id="qr-reader" className="w-full max-w-[300px] overflow-hidden rounded-md border" />
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
