'use client';

export type AdjustmentSettings = {
  brightness: number;
  contrast: number;
  saturation: number;
};

export type FilterType = 'none' | 'blur' | 'sharpen' | 'vintage' | 'grayscale' | 'sepia';

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeOptions = {
  width: number;
  height: number;
};

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function cloneCanvas(source: HTMLCanvasElement) {
  const cloned = createCanvas(source.width, source.height);
  const ctx = cloned.getContext('2d');
  if (ctx) {
    ctx.drawImage(source, 0, 0);
  }
  return cloned;
}

export function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image.'));

    if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        image.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(source);
    } else {
      image.src = source;
    }
  });
}

export function drawImageOnCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | HTMLCanvasElement,
  width?: number,
  height?: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const targetWidth = width ?? image.width;
  const targetHeight = height ?? image.height;

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvas;
}

export function applyCrop(canvas: HTMLCanvasElement, crop: CropRect) {
  const source = cloneCanvas(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const x = Math.max(0, Math.min(source.width - 1, crop.x));
  const y = Math.max(0, Math.min(source.height - 1, crop.y));
  const width = Math.max(1, Math.min(source.width - x, crop.width));
  const height = Math.max(1, Math.min(source.height - y, crop.height));

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);

  return canvas;
}

export function applyRotate(canvas: HTMLCanvasElement, degrees: number) {
  const source = cloneCanvas(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = Math.round(source.width * cos + source.height * sin);
  const height = Math.round(source.width * sin + source.height * cos);

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  ctx.translate(width / 2, height / 2);
  ctx.rotate(radians);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);

  return canvas;
}

export function applyResize(canvas: HTMLCanvasElement, options: ResizeOptions) {
  const source = cloneCanvas(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  return canvas;
}

function applyConvolution(canvas: HTMLCanvasElement, kernel: number[], divisor = 1, bias = 0) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = ctx.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(canvas.width - 1, Math.max(0, x + kx));
          const py = Math.min(canvas.height - 1, Math.max(0, y + ky));
          const offset = (py * canvas.width + px) * 4;
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];

          r += imageData.data[offset] * weight;
          g += imageData.data[offset + 1] * weight;
          b += imageData.data[offset + 2] * weight;
          a += imageData.data[offset + 3] * weight;
        }
      }

      const index = (y * canvas.width + x) * 4;
      result.data[index] = Math.min(255, Math.max(0, r / divisor + bias));
      result.data[index + 1] = Math.min(255, Math.max(0, g / divisor + bias));
      result.data[index + 2] = Math.min(255, Math.max(0, b / divisor + bias));
      result.data[index + 3] = imageData.data[index + 3];
    }
  }

  ctx.putImageData(result, 0, 0);
}

function applyVintageTone(canvas: HTMLCanvasElement, intensity = 1) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];

    imageData.data[i] = Math.min(255, r * (1 + 0.08 * intensity) + 14);
    imageData.data[i + 1] = Math.min(255, g * (1 - 0.04 * intensity) + 6);
    imageData.data[i + 2] = Math.min(255, b * (1 - 0.18 * intensity));
  }
  ctx.putImageData(imageData, 0, 0);
}

export function applyCanvasFilters(
  canvas: HTMLCanvasElement,
  adjustments: AdjustmentSettings,
  filter: FilterType = 'none',
  intensity = 1
) {
  const source = cloneCanvas(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const filterParts = [
    `brightness(${Math.max(0, adjustments.brightness)}%)`,
    `contrast(${Math.max(0, adjustments.contrast)}%)`,
    `saturate(${Math.max(0, adjustments.saturation)}%)`,
  ];

  if (filter === 'blur') {
    filterParts.push(`blur(${Math.min(20, intensity * 4)}px)`);
  }
  if (filter === 'grayscale') {
    filterParts.push(`grayscale(${Math.min(100, 40 * intensity)}%)`);
  }
  if (filter === 'sepia') {
    filterParts.push(`sepia(${Math.min(100, 50 * intensity)}%)`);
  }
  if (filter === 'vintage') {
    filterParts.push(`sepia(${Math.min(80, 25 * intensity)}%)`);
    filterParts.push(`contrast(${Math.min(150, 100 + intensity * 10)}%)`);
    filterParts.push(`saturate(${Math.max(50, 100 - intensity * 10)}%)`);
  }

  canvas.width = source.width;
  canvas.height = source.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = filterParts.filter(Boolean).join(' ');
  ctx.drawImage(source, 0, 0);
  ctx.filter = 'none';

  if (filter === 'sharpen') {
    applyConvolution(canvas, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
  }
  if (filter === 'vintage') {
    applyVintageTone(canvas, intensity);
  }

  return canvas;
}

export function exportCanvas(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.92
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return reject(new Error('Unable to export canvas.'));
        }
        resolve(blob);
      },
      `image/${format === 'jpeg' ? 'jpeg' : format}`,
      quality
    );
  });
}
