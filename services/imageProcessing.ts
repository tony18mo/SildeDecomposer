
import { BoundingBox } from '../types';

export const CROP_PADDING = 50; 

/**
 * Converts a File object to a base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Loads a base64 string into an HTMLImageElement with a safety timeout.
 */
export const loadImage = (src: string, timeoutMs: number = 10000): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    const timer = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        reject(new Error(`LoadImage timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    img.crossOrigin = "anonymous";
    img.src = src;
    
    img.onload = () => {
        clearTimeout(timer);
        resolve(img);
    };
    
    img.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
    };
  });
};

/**
 * Crops a specific region from the source image.
 */
export const cropImage = (
  sourceImage: HTMLImageElement,
  box: [number, number, number, number], 
  padding: number = CROP_PADDING
): string => {
  const [ymin, xmin, ymax, xmax] = box;
  const width = sourceImage.naturalWidth;
  const height = sourceImage.naturalHeight;

  let y1 = (ymin / 1000) * height;
  let x1 = (xmin / 1000) * width;
  let y2 = (ymax / 1000) * height;
  let x2 = (xmax / 1000) * width;

  x1 = Math.max(0, x1 - padding);
  y1 = Math.max(0, y1 - padding);
  x2 = Math.min(width, x2 + padding);
  y2 = Math.min(height, y2 + padding);

  const cropWidth = x2 - x1;
  const cropHeight = y2 - y1;

  if (cropWidth <= 0 || cropHeight <= 0) return '';

  const MAX_DIMENSION = 1024;
  let finalWidth = cropWidth;
  let finalHeight = cropHeight;

  if (cropWidth > MAX_DIMENSION || cropHeight > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / cropWidth, MAX_DIMENSION / cropHeight);
    finalWidth = cropWidth * scale;
    finalHeight = cropHeight * scale;
  }

  const canvas = document.createElement('canvas');
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(sourceImage, x1, y1, cropWidth, cropHeight, 0, 0, finalWidth, finalHeight);
  return canvas.toDataURL('image/png');
};

/**
 * Pads an image with white space to make it square (1:1).
 */
export const padImageToSquare = async (base64Image: string): Promise<string> => {
    const img = await loadImage(base64Image);
    const size = Math.max(img.width, img.height);
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if(!ctx) return base64Image;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const x = (size - img.width) / 2;
    const y = (size - img.height) / 2;
    ctx.drawImage(img, x, y);

    return canvas.toDataURL('image/png');
};

/**
 * Robustly restores an original sized image from a square generative model output.
 * Fixes "zoomed in" issues by calculating correct scaling between input and output.
 */
export const unpadGeneratedImage = async (
  generatedBase64: string,
  originalWidth: number,
  originalHeight: number
): Promise<string> => {
  const img = await loadImage(generatedBase64);
  const canvas = document.createElement('canvas');
  canvas.width = originalWidth;
  canvas.height = originalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return generatedBase64;

  const W_gen = img.width;
  const H_gen = img.height;
  const S_orig = Math.max(originalWidth, originalHeight);

  // The generated image represents the padded square.
  // We need to calculate the area of the original image relative to that square.
  const sWidth = (originalWidth / S_orig) * W_gen;
  const sHeight = (originalHeight / S_orig) * H_gen;
  const sx = (W_gen - sWidth) / 2;
  const sy = (H_gen - sHeight) / 2;

  // Draw scaled and cropped part back to canvas
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, originalWidth, originalHeight);
  
  return canvas.toDataURL('image/png');
};

/**
 * Removes white background pixels.
 * Uses a surgical approach to protect white containers.
 */
export const removeWhiteBackground = async (
  base64Image: string, 
  mode: 'flood' | 'all' = 'flood',
  tolerance: number = 8 // Very tight tolerance to protect containers
): Promise<string> => {
  const img = await loadImage(base64Image);
  const canvas = document.createElement('canvas');
  const w = img.width;
  const h = img.height;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return base64Image;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const isWhite = (idx: number) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    return a > 0 && r > 255 - tolerance && g > 255 - tolerance && b > 255 - tolerance;
  };

  if (mode === 'all') {
    for (let i = 0; i < data.length; i += 4) {
      if (isWhite(i)) data[i + 3] = 0;
    }
  } else {
    // Perimeter-seeded Flood Fill
    const visited = new Uint8Array(w * h);
    const queue: [number, number][] = [];
    
    const addSeed = (x: number, y: number) => {
      const idx = (y * w + x) * 4;
      if (!visited[y * w + x] && isWhite(idx)) {
        visited[y * w + x] = 1;
        queue.push([x, y]);
      }
    };

    // Seeds from the very edge
    for (let x = 0; x < w; x++) { addSeed(x, 0); addSeed(x, h - 1); }
    for (let y = 0; y < h; y++) { addSeed(0, y); addSeed(w - 1, y); }

    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      const idx = (cy * w + cx) * 4;
      data[idx + 3] = 0;

      const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !visited[ny * w + nx]) {
          const nIdx = (ny * w + nx) * 4;
          if (isWhite(nIdx)) {
            visited[ny * w + nx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

export const getAspectRatio = (box: [number, number, number, number]): string => {
    const [ymin, xmin, ymax, xmax] = box;
    const w = xmax - xmin;
    const h = ymax - ymin;
    const ratio = w / h;
    if (ratio > 1.5) return '16:9';
    if (ratio > 1.2) return '4:3';
    if (ratio < 0.6) return '9:16';
    if (ratio < 0.8) return '3:4';
    return '1:1';
};

export const resizeImage = async (base64Str: string, maxDimension: number = 1536): Promise<string> => {
    return new Promise(async (resolve) => {
        try {
            const img = await loadImage(base64Str);
            let { width, height } = img;
            if (width <= maxDimension && height <= maxDimension) {
                resolve(base64Str);
                return;
            }
            const scale = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64Str); return; }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
            resolve(base64Str);
        }
    });
};
