'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { FilterControls } from '@/components/FilterControls';
import { useCanvas } from '@/hooks/useCanvas';
import {
  AdjustmentSettings,
  FilterType,
  CropRect,
  ResizeOptions,
  applyCanvasFilters,
  applyCrop,
  applyResize,
  applyRotate,
  drawImageOnCanvas,
  exportCanvas,
  loadImage,
} from '@/utils/imageProcessing';

const defaultAdjustments: AdjustmentSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

export function ImageEditor() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentSettings>(defaultAdjustments);
  const [filter, setFilter] = useState<FilterType>('none');
  const [rotation, setRotation] = useState(0);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [annotationEnabled, setAnnotationEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Load an image to begin editing.');
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const {
    canvasRef,
    overlayRef,
    history,
    historyIndex,
    drawMode,
    setDrawMode,
    setAnnotationSettings,
    setCanvasSize,
    loadCanvasImage,
    undo,
    redo,
    pushHistory,
    exportCanvas: exportBlob,
    mergeOverlay,
    startDraw,
    draw,
    stopDraw,
  } = useCanvas();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const beforeAfterControls = useMemo(
    () => ({ isActive: comparisonMode }),
    [comparisonMode]
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatusMessage('Loading image...');

    try {
      const image = await loadImage(file);
      originalImageRef.current = image;
      setOriginalUrl(image.src);
      setAdjustmentState(defaultAdjustments);
      setFilter('none');
      setRotation(0);
      await loadCanvasImage(image);
      setStatusMessage('Image loaded. Use the controls to edit.');
    } catch (error) {
      setStatusMessage('Unable to load image file.');
    }
  };

  const setAdjustmentState = (next: AdjustmentSettings) => {
    setAdjustments(next);
  };

  const handleAdjustmentsChange = (next: AdjustmentSettings) => {
    setAdjustments(next);
    const canvas = canvasRef.current;
    if (!canvas) return;
    mergeOverlay();
    applyCanvasFilters(canvas, next, filter);
    pushHistory();
  };
    setAdjustments(next);
    const canvas = canvasRef.current;
    if (!canvas) return;
    mergeOverlay();
    applyCanvasFilters(canvas, next, filter);
  };

  const handleFilterChange = (nextFilter: FilterType) => {
    setFilter(nextFilter);
    const canvas = canvasRef.current;
    if (!canvas) return;
    mergeOverlay();
    applyCanvasFilters(canvas, adjustments, nextFilter);
    pushHistory();
  };

  const handleRotate = (degrees: number) => {
    const adjusted = (degrees + 360) % 360;
    setRotation(adjusted);
    const canvas = canvasRef.current;
    if (!canvas) return;
    mergeOverlay();
    applyRotate(canvas, adjusted);
    setCanvasSize(canvas.width, canvas.height);
    pushHistory();
  };

  const handleResize = (size: ResizeOptions) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    mergeOverlay();
    applyResize(canvas, size);
    setCanvasSize(canvas.width, canvas.height);
    pushHistory();
  };

  const handleCrop = (crop: CropRect) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    mergeOverlay();
    applyCrop(canvas, crop);
    setCanvasSize(canvas.width, canvas.height);
    pushHistory();
  };

  const handleToggleAnnotation = (enabled: boolean) => {
    setAnnotationEnabled(enabled);
    setDrawMode(enabled);
    if (!enabled) {
      mergeOverlay();
    }
  };

  const handleExport = async (format: 'png' | 'jpeg' | 'webp') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    mergeOverlay();
    const blob = await exportBlob(format, 0.92);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName || 'edited-image'}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleReset = async () => {
    const original = originalImageRef.current;
    if (!original) return;
    setAdjustments(defaultAdjustments);
    setFilter('none');
    setRotation(0);
    setAnnotationEnabled(false);
    setDrawMode(false);
    await loadCanvasImage(original);
  };

  const imagePlaceholder = (
    <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-slate-500">
      <div>
        <p className="text-lg font-semibold">No image selected</p>
        <p className="mt-2 text-sm">Upload a JPEG, PNG, or WEBP to begin editing.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside>
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700">Upload Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              <p>{fileName || 'Filename: none'}</p>
              <p>{statusMessage}</p>
            </div>
            <FilterControls
              adjustments={adjustments}
              filter={filter}
              rotation={rotation}
              annotationEnabled={annotationEnabled}
              comparisonMode={comparisonMode}
              canUndo={canUndo}
              canRedo={canRedo}
              onAdjustmentsChange={handleAdjustmentsChange}
              onFilterChange={handleFilterChange}
              onRotate={handleRotate}
              onResize={handleResize}
              onCrop={handleCrop}
              onToggleAnnotation={handleToggleAnnotation}
              onUndo={undo}
              onRedo={redo}
              onExport={handleExport}
              onReset={handleReset}
              onToggleComparison={() => setComparisonMode((active) => !active)}
            />
          </div>
        </aside>

        <main className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Image Editor</h1>
                <p className="text-sm text-slate-600">Crop, filter, annotate, compare, and export images directly in the browser.</p>
              </div>
              <div className="text-sm text-slate-500">History: {historyIndex + 1}/{history.length || 0}</div>
            </div>

            {comparisonMode && originalUrl ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">Original</p>
                  <img src={originalUrl} alt="Original upload" className="h-full w-full rounded-2xl object-contain" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">Edited</p>
                  <div className="relative overflow-hidden rounded-2xl bg-black/5">
                    <canvas ref={canvasRef} className="block w-full" />
                    <canvas
                      ref={overlayRef}
                      className={`absolute inset-0 ${annotationEnabled ? 'cursor-crosshair' : 'pointer-events-none'} `}
                      onPointerDown={startDraw}
                      onPointerMove={draw}
                      onPointerUp={stopDraw}
                      onPointerLeave={stopDraw}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {originalUrl ? (
                  <div className="relative overflow-hidden rounded-2xl bg-black/5">
                    <canvas ref={canvasRef} className="block w-full" />
                    <canvas
                      ref={overlayRef}
                      className={`absolute inset-0 ${annotationEnabled ? 'cursor-crosshair' : 'pointer-events-none'}`}
                      onPointerDown={startDraw}
                      onPointerMove={draw}
                      onPointerUp={stopDraw}
                      onPointerLeave={stopDraw}
                    />
                  </div>
                ) : (
                  imagePlaceholder
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
