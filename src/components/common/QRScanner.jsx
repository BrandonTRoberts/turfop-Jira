import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, Loader2, CameraOff } from 'lucide-react';

export default function QRScanner({ onScan, onClose, title = "Scan QR Code" }) {
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(true);
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrCode;

    async function startScanner() {
      try {
        html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;
        let hasScanned = false;
        
        await html5QrCode.start(
          { facingMode: "environment" }, // Prefer back camera
          {
            fps: 10,
            qrbox: { width: 300, height: 150 }, // Wider box for 1D barcodes
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (hasScanned) return;
            hasScanned = true;
            onScan(decodedText);
          },
          (errorMessage) => {
            // normal background errors while searching for QR
          }
        );
        setStarting(false);
      } catch (err) {
        console.error("Camera start error:", err);
        setStarting(false);
        setError("Could not access camera. Please ensure you have granted camera permissions to this site.");
      }
    }

    startScanner();

    // Cleanup on unmount
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border shadow-lg rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 flex flex-col items-center justify-center min-h-[300px] relative bg-muted/30">
          {starting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-10">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p className="text-sm">Requesting camera access...</p>
            </div>
          )}
          
          {error ? (
            <div className="text-center text-red-500 flex flex-col items-center p-4">
              <CameraOff className="h-8 w-8 mb-2 opacity-80" />
              <p className="text-sm font-medium">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>Close Scanner</Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Position the QR code inside the frame.
              </p>
              {/* The container html5-qrcode attaches to */}
              <div id="qr-reader" className="w-full max-w-[300px] overflow-hidden rounded-lg shadow-sm border border-border" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
