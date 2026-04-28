'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

export type AnnotationSettings = {
  color: string;
  size: number;
  opacity: number;
};

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotationSettings, setAnnotationSettings] = useState<AnnotationSettings>({
    color: '#ff0000',
    size: 4,
    opacity: 0.8,
  });
  const [drawMode, setDrawMode] = useState(false);

  const getCanvas = useCallback(() => canvasRef.current, []);
  const getOverlay = useCallback(() => overlayRef.current, []);

  const updateSizes = useCallback(() => {
    const canvas = getCanvas();
    const overlay = getOverlay();
    if (!canvas || !overlay) return;
    overlay.width = canvas.width;
    overlay.height = canvas.height;
  }, [getCanvas, getOverlay]);

  useEffect(() => {
    updateSizes();
  }, [updateSizes]);

  const getCanvasContext = useCallback((canvas: HTMLCanvasElement | null) => {
    return canvas?.getContext('2d');
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    setHistory((previous) => {
      const next = previous.slice(0, historyIndex + 1);
      return [...next, dataUrl];
    });
    setHistoryIndex((index) => index + 1);
  }, [getCanvas, historyIndex]);

  const loadHistorySnapshot = useCallback(
    (snapshot: string) => {
      const canvas = getCanvas();
      const overlay = getOverlay();
      if (!canvas || !overlay) return;

      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        const ctx = getCanvasContext(canvas);
        if (!ctx) return;

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        getCanvasContext(overlay)?.clearRect(0, 0, overlay.width, overlay.height);
      };
      image.src = snapshot;
    },
    [getCanvas, getOverlay, getCanvasContext]
  );

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const previousIndex = historyIndex - 1;
    const snapshot = history[previousIndex];
    if (!snapshot) return;
    loadHistorySnapshot(snapshot);
    setHistoryIndex(previousIndex);
  }, [history, historyIndex, loadHistorySnapshot]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const snapshot = history[nextIndex];
    if (!snapshot) return;
    loadHistorySnapshot(snapshot);
    setHistoryIndex(nextIndex);
  }, [history, historyIndex, loadHistorySnapshot]);

  const loadCanvasImage = useCallback(
    (source: HTMLCanvasElement | HTMLImageElement) => {
      const canvas = getCanvas();
      const overlay = getOverlay();
      const ctx = getCanvasContext(canvas);
      if (!canvas || !ctx || !overlay) return;

      canvas.width = source.width;
      canvas.height = source.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0);
      updateSizes();
      pushHistory();
    },
    [getCanvas, getOverlay, getCanvasContext, pushHistory, updateSizes]
  );

  const clearOverlay = useCallback(() => {
    const overlay = getOverlay();
    const ctx = getCanvasContext(overlay);
    if (!overlay || !ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, [getOverlay, getCanvasContext]);

  const mergeOverlay = useCallback(() => {
    const canvas = getCanvas();
    const overlay = getOverlay();
    const ctx = getCanvasContext(canvas);
    if (!canvas || !overlay || !ctx) return;

    ctx.drawImage(overlay, 0, 0);
    clearOverlay();
    pushHistory();
  }, [clearOverlay, getCanvas, getOverlay, getCanvasContext, pushHistory]);

  const setCanvasSize = useCallback(
    (width: number, height: number) => {
      const canvas = getCanvas();
      const overlay = getOverlay();
      if (!canvas || !overlay) return;
      canvas.width = width;
      canvas.height = height;
      overlay.width = width;
      overlay.height = height;
      updateSizes();
      pushHistory();
    },
    [getCanvas, getOverlay, pushHistory, updateSizes]
  );

  const getCanvasDataUrl = useCallback(() => {
    const canvas = getCanvas();
    return canvas?.toDataURL('image/png') ?? '';
  }, [getCanvas]);

  const exportCanvas = useCallback(
    async (format: 'png' | 'jpeg' | 'webp' = 'png', quality = 0.92) => {
      const canvas = getCanvas();
      if (!canvas) return null;

      mergeOverlay();
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          `image/${format === 'jpeg' ? 'jpeg' : format}`,
          quality
        );
      });
    },
    [getCanvas, mergeOverlay]
  );

  const getRelativeCoords = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const overlay = getOverlay();
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, [getOverlay]);

  const startDraw = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!drawMode) return;
      const overlay = getOverlay();
      const ctx = getCanvasContext(overlay);
      if (!overlay || !ctx) return;

      overlay.setPointerCapture(event.pointerId);
      const point = getRelativeCoords(event);
      ctx.strokeStyle = annotationSettings.color;
      ctx.lineWidth = annotationSettings.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = annotationSettings.opacity;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      setIsDrawing(true);
    },
    [annotationSettings, drawMode, getCanvasContext, getOverlay, getRelativeCoords]
  );

  const draw = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !drawMode) return;
      const overlay = getOverlay();
      const ctx = getCanvasContext(overlay);
      if (!overlay || !ctx) return;

      const point = getRelativeCoords(event);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    },
    [drawMode, getCanvasContext, getOverlay, getRelativeCoords, isDrawing]
  );

  const stopDraw = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (!drawMode) return;
      const overlay = getOverlay();
      const ctx = getCanvasContext(overlay);
      if (!overlay || !ctx) return;

      if (isDrawing) {
        ctx.closePath();
        setIsDrawing(false);
        overlay.releasePointerCapture(event.pointerId);
        mergeOverlay();
      }
    },
    [drawMode, getCanvasContext, getOverlay, isDrawing, mergeOverlay]
  );

  const clearAnnotations = useCallback(() => {
    clearOverlay();
    pushHistory();
  }, [clearOverlay, pushHistory]);

  return {
    canvasRef,
    overlayRef,
    history,
    historyIndex,
    drawMode,
    annotationSettings,
    isDrawing,
    setDrawMode,
    setAnnotationSettings,
    pushHistory,
    undo,
    redo,
    loadCanvasImage,
    mergeOverlay,
    clearAnnotations,
    setCanvasSize,
    getCanvasDataUrl,
    exportCanvas,
    startDraw,
    draw,
    stopDraw,
  };
}
