"use client";

/**
 * Escáner de códigos de barras 100 % en el navegador.
 *
 * Estrategia en dos niveles:
 *
 *  1. **`BarcodeDetector` nativo** si el navegador lo soporta (Chrome y Edge
 *     en Android y escritorio). Es una API del sistema: coste de bundle CERO
 *     y decodificación acelerada por hardware.
 *
 *  2. **@zxing/browser** como respaldo (Safari, Firefox). Se carga con
 *     `import()` dinámico, así que los ~200 KB de ZXing sólo se descargan en
 *     los navegadores que realmente los necesitan.
 *
 * En ambos casos el vídeo nunca sale del dispositivo: no se sube ningún
 * fotograma a ningún servidor.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Tipado mínimo de la API nativa, que aún no está en lib.dom. */
interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

function getNativeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

export type ScannerStatus =
  | "idle"
  | "starting"
  | "scanning"
  | "denied"
  | "unsupported"
  | "error";

export interface BarcodeScannerProps {
  /** Se llama una sola vez por lectura válida. */
  onDetected: (barcode: string) => void;
  onError?: (message: string) => void;
  /** Pausa el escaneo sin apagar la cámara (p. ej. mientras se carga la ficha). */
  paused?: boolean;
}

export function BarcodeScanner({
  onDetected,
  onError,
  paused = false,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const pausedRef = useRef(paused);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  /** Un único punto de emisión: evita disparar dos veces el mismo código. */
  const emit = useCallback(
    (value: string) => {
      if (stoppedRef.current || pausedRef.current) return;
      pausedRef.current = true; // se rearma cuando el padre cambie `paused`
      onDetected(value);
    },
    [onDetected],
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    let zxingControls: { stop: () => void } | null = null;

    async function start() {
      setStatus("starting");

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        onError?.("Este navegador no permite acceder a la cámara.");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        const denied =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError");
        setStatus(denied ? "denied" : "error");
        onError?.(
          denied
            ? "Necesitamos permiso para usar la cámara."
            : "No se ha podido abrir la cámara.",
        );
        return;
      }

      if (stoppedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.setAttribute("playsinline", "true"); // imprescindible en iOS
      await video.play().catch(() => undefined);

      // Linterna, si el dispositivo la expone.
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean })
        | undefined;
      setHasTorch(Boolean(caps?.torch));

      setStatus("scanning");

      /* ---- Camino 1: BarcodeDetector nativo ---- */
      const Detector = getNativeDetector();
      if (Detector) {
        const detector = new Detector({ formats: FORMATS });

        const tick = async () => {
          if (stoppedRef.current) return;
          if (!pausedRef.current && video.readyState >= 2) {
            try {
              const codes = await detector.detect(video);
              const first = codes[0];
              if (first?.rawValue) emit(first.rawValue);
            } catch {
              // Un fotograma ilegible no es un error: seguimos.
            }
          }
          rafRef.current = requestAnimationFrame(() => void tick());
        };

        rafRef.current = requestAnimationFrame(() => void tick());
        return;
      }

      /* ---- Camino 2: ZXing (carga diferida) ---- */
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (stoppedRef.current) return;

        const reader = new BrowserMultiFormatReader();
        zxingControls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) emit(result.getText());
        });
      } catch {
        setStatus("error");
        onError?.("No se ha podido inicializar el lector de códigos.");
      }
    }

    void start();

    return () => {
      stop();
      zxingControls?.stop();
    };
  }, [emit, onError, stop]);

  /** Rearma el escaneo cuando el padre quita la pausa. */
  useEffect(() => {
    if (!paused) pausedRef.current = false;
  }, [paused]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      setHasTorch(false);
    }
  }, [torchOn]);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="scanner-video" muted playsInline />

      {/* Marco de puntería */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-32 w-[78%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
      </div>

      {hasTorch && (
        <button
          type="button"
          onClick={() => void toggleTorch()}
          className="absolute right-3 bottom-3 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-900"
          aria-pressed={torchOn}
        >
          {torchOn ? "Apagar luz" : "Encender luz"}
        </button>
      )}

      <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-center text-sm text-white">
        {status === "starting" && "Abriendo la cámara…"}
        {status === "scanning" && "Enfoca el código de barras"}
        {status === "denied" && "Permiso de cámara denegado"}
        {status === "unsupported" && "Tu navegador no soporta la cámara"}
        {status === "error" && "Ha fallado el escáner"}
      </p>
    </div>
  );
}
