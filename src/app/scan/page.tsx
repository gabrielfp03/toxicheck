"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { isValidBarcode } from "@/lib/openfoodfacts";

export default function ScanPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const handleDetected = useCallback(
    (code: string) => {
      if (!isValidBarcode(code)) {
        setMessage("Lectura incompleta, vuelve a intentarlo.");
        // Rearmamos el escáner tras un instante.
        setPaused(true);
        setTimeout(() => setPaused(false), 800);
        return;
      }

      setPaused(true);
      // Vibración corta de confirmación, si el dispositivo la soporta.
      navigator.vibrate?.(40);
      router.push(`/product?code=${code}`);
    },
    [router],
  );

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-xl font-bold">Escanear</h1>

      <BarcodeScanner
        onDetected={handleDetected}
        onError={setMessage}
        paused={paused}
      />

      {message && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </p>
      )}

      <p className="text-center text-sm" style={{ color: "var(--muted)" }}>
        La imagen de la cámara no sale de tu dispositivo.
      </p>
    </div>
  );
}
