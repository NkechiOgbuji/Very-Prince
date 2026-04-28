'use client';

import { useMemo, useState } from 'react';
import type { AdjustmentSettings, CropRect, FilterType, ResizeOptions } from '@/utils/imageProcessing';

export type FilterControlsProps = {
  adjustments: AdjustmentSettings;
  filter: FilterType;
  rotation: number;
  annotationEnabled: boolean;
  comparisonMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAdjustmentsChange: (settings: AdjustmentSettings) => void;
  onFilterChange: (filter: FilterType) => void;
  onRotate: (degrees: number) => void;
  onResize: (size: ResizeOptions) => void;
  onCrop: (crop: CropRect) => void;
  onToggleAnnotation: (enabled: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: (format: 'png' | 'jpeg' | 'webp') => void;
  onReset: () => void;
  onToggleComparison: () => void;
};

const filterOptions: FilterType[] = ['none', 'blur', 'sharpen', 'vintage', 'grayscale', 'sepia'];

export function FilterControls({
  adjustments,
  filter,
  rotation,
  annotationEnabled,
  comparisonMode,
  canUndo,
  canRedo,
  onAdjustmentsChange,
  onFilterChange,
  onRotate,
  onResize,
  onCrop,
  onToggleAnnotation,
  onUndo,
  onRedo,
  onExport,
  onReset,
  onToggleComparison,
}: FilterControlsProps) {
  const [cropWidth, setCropWidth] = useState('400');
  const [cropHeight, setCropHeight] = useState('300');
  const [resizeWidth, setResizeWidth] = useState('800');
  const [resizeHeight, setResizeHeight] = useState('600');

  const cropValues = useMemo(
    () => ({
      x: 0,
      y: 0,
      width: Math.max(1, Number(cropWidth) || 1),
      height: Math.max(1, Number(cropHeight) || 1),
    }),
    [cropWidth, cropHeight]
  );

  const resizeValues = useMemo(
    () => ({
      width: Math.max(1, Number(resizeWidth) || 1),
      height: Math.max(1, Number(resizeHeight) || 1),
    }),
    [resizeWidth, resizeHeight]
  );

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
          onClick={() => onRotate((rotation + 90) % 360)}
        >
          Rotate 90°
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
          onClick={() => onRotate((rotation - 90 + 360) % 360)}
        >
          Rotate -90°
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold">Crop</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs text-slate-600">
              Width
              <input
                type="number"
                value={cropWidth}
                onChange={(event) => setCropWidth(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Height
              <input
                type="number"
                value={cropHeight}
                onChange={(event) => setCropHeight(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
          </div>
          <button
            type="button"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
            onClick={() => onCrop(cropValues)}
          >
            Apply Crop
          </button>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold">Resize</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs text-slate-600">
              Width
              <input
                type="number"
                value={resizeWidth}
                onChange={(event) => setResizeWidth(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Height
              <input
                type="number"
                value={resizeHeight}
                onChange={(event) => setResizeHeight(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
          </div>
          <button
            type="button"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
            onClick={() => onResize(resizeValues)}
          >
            Apply Resize
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold">Adjustments</h3>
        <div className="space-y-3 pt-2">
          {[
            { label: 'Brightness', key: 'brightness' as const, value: adjustments.brightness },
            { label: 'Contrast', key: 'contrast' as const, value: adjustments.contrast },
            { label: 'Saturation', key: 'saturation' as const, value: adjustments.saturation },
          ].map(({ label, key, value }) => (
            <label key={key} className="block text-xs text-slate-600">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{label}</span>
                <span>{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={value}
                onChange={(event) =>
                  onAdjustmentsChange({
                    ...adjustments,
                    [key]: Number(event.target.value),
                  })
                }
                className="mt-2 w-full"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold">Filters</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onFilterChange(option)}
              className={`rounded-full px-3 py-2 text-sm transition ${filter === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
          onClick={() => onToggleAnnotation(!annotationEnabled)}
        >
          {annotationEnabled ? 'Disable Annotation' : 'Enable Annotation'}
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
          onClick={onToggleComparison}
        >
          {comparisonMode ? 'Hide Compare' : 'Before / After'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className="rounded-lg bg-white px-3 py-2 text-slate-800 ring-1 ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          className="rounded-lg bg-white px-3 py-2 text-slate-800 ring-1 ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Redo
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
          onClick={() => onExport('png')}
        >
          Export PNG
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
          onClick={() => onExport('jpeg')}
        >
          Export JPEG
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700"
          onClick={() => onExport('webp')}
        >
          Export WEBP
        </button>
      </div>

      <button
        type="button"
        className="w-full rounded-lg bg-white px-3 py-2 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
        onClick={onReset}
      >
        Reset Image
      </button>
    </section>
  );
}
