import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rolling video buffer using MediaRecorder.
 * Continuously records the camera in small chunks and keeps the most recent
 * `bufferSeconds` worth of data in memory. `extractClip(secondsBefore, secondsAfter)`
 * returns a Blob containing the requested time window (centered around "now").
 *
 * v1.4.8 — Multi-camera support:
 *  - enumerates all video input devices
 *  - exposes `devices`, `activeDeviceId`, and `switchCamera(deviceId)` to hot-swap
 *    the source without a page reload. The MediaRecorder is restarted seamlessly
 *    so the rolling buffer always belongs to the currently visible camera.
 */
export type CameraStatus = "idle" | "starting" | "live" | "denied" | "error";

interface BufferChunk {
  ts: number; // timestamp ms when chunk was produced
  blob: Blob;
}

interface Options {
  bufferSeconds?: number; // total rolling window
  timesliceMs?: number;   // chunk granularity
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useRollingBuffer({ bufferSeconds = 20, timesliceMs = 250 }: Options = {}) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BufferChunk[]>([]);
  const mimeRef = useRef<string>("video/webm");

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      setDevices(cams);
      return cams;
    } catch {
      return [];
    }
  }, []);

  const stopInternal = useCallback(() => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
  }, []);

  const startWithDevice = useCallback(async (deviceId?: string | null) => {
    setStatus("starting");
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // stop any prior stream/recorder before swapping
      stopInternal();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Track the active device id (resolve from track if not explicitly chosen)
      const settings = stream.getVideoTracks()[0]?.getSettings();
      setActiveDeviceId(deviceId ?? settings?.deviceId ?? null);

      // Pick a supported mime
      const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
      const mime = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "video/webm";
      mimeRef.current = mime;
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_000_000 });
      rec.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        const now = Date.now();
        chunksRef.current.push({ ts: now, blob: e.data });
        const cutoff = now - (bufferSeconds + 5) * 1000;
        while (chunksRef.current.length && chunksRef.current[0].ts < cutoff) {
          chunksRef.current.shift();
        }
      };
      rec.start(timesliceMs);
      recorderRef.current = rec;
      setStatus("live");

      // Now that permission is granted, labels become available.
      void refreshDevices();
    } catch (e) {
      const msg = (e as Error).message || "camera error";
      setError(msg);
      setStatus(/denied|permission/i.test(msg) ? "denied" : "error");
    }
  }, [bufferSeconds, timesliceMs, refreshDevices, stopInternal]);

  const start = useCallback(async () => {
    if (status === "live" || status === "starting") return;
    await startWithDevice(activeDeviceId);
  }, [status, startWithDevice, activeDeviceId]);

  const stop = useCallback(() => {
    stopInternal();
    setStatus("idle");
  }, [stopInternal]);

  /** Hot-swap to another video input without tearing down the page. */
  const switchCamera = useCallback(async (deviceId: string) => {
    if (deviceId === activeDeviceId && status === "live") return;
    await startWithDevice(deviceId);
  }, [activeDeviceId, status, startWithDevice]);

  // Refresh devices when the OS reports plug/unplug
  useEffect(() => {
    void refreshDevices();
    const handler = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [refreshDevices]);

  useEffect(() => {
    return () => { stopInternal(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Build a Blob from chunks within [now-secondsBefore, now+secondsAfter].
   * Waits `secondsAfter` real seconds before slicing.
   * Clips are sourced from whichever camera is currently active.
   */
  const extractClip = useCallback(
    async (secondsBefore = 5, secondsAfter = 2): Promise<Blob | null> => {
      if (status !== "live") return null;
      const triggerTs = Date.now();
      if (secondsAfter > 0) {
        await new Promise((r) => setTimeout(r, secondsAfter * 1000));
      }
      const from = triggerTs - secondsBefore * 1000;
      const to = triggerTs + secondsAfter * 1000;
      const slice = chunksRef.current
        .filter((c) => c.ts >= from && c.ts <= to + 500)
        .map((c) => c.blob);
      if (slice.length === 0) return null;
      return new Blob(slice, { type: mimeRef.current });
    },
    [status],
  );

  return {
    videoRef, status, error, start, stop, extractClip,
    devices, activeDeviceId, switchCamera, refreshDevices,
  };
}
