/**
 * Lightweight canvas polyfill for PNG generation
 * No native dependencies — pure JavaScript
 */

import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import zlib from 'node:zlib';

/**
 * Minimal Canvas implementation that can output PNG
 */
export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8ClampedArray(width * height * 4); // RGBA
    this._ctx = null;
  }
  
  getContext(type) {
    if (type === '2d') {
      if (!this._ctx) {
        this._ctx = new CanvasRenderingContext2D(this);
      }
      return this._ctx;
    }
    throw new Error('Only 2d context supported');
  }
  
  toBuffer() {
    return encodePNG(this.pixels, this.width, this.height);
  }
}

/**
 * Minimal 2D rendering context
 */
class CanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this._path = [];
    this._clipPath = null;
    this._stateStack = [];
  }
  
  save() {
    this._stateStack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      clipPath: this._clipPath
    });
  }
  
  restore() {
    if (this._stateStack.length > 0) {
      const state = this._stateStack.pop();
      this.fillStyle = state.fillStyle;
      this.strokeStyle = state.strokeStyle;
      this.lineWidth = state.lineWidth;
      this._clipPath = state.clipPath;
    }
  }
  
  beginPath() {
    this._path = [];
  }
  
  moveTo(x, y) {
    this._path.push({ type: 'move', x, y });
  }
  
  lineTo(x, y) {
    this._path.push({ type: 'line', x, y });
  }
  
  arc(x, y, radius, startAngle, endAngle, anticlockwise = false) {
    this._path.push({ type: 'arc', x, y, radius, startAngle, endAngle, anticlockwise });
  }
  
  ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise = false) {
    this._path.push({ type: 'ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise });
  }
  
  closePath() {
    this._path.push({ type: 'close' });
  }
  
  fillRect(x, y, width, height) {
    const color = parseColor(this.fillStyle);
    for (let py = Math.floor(y); py < Math.floor(y + height); py++) {
      for (let px = Math.floor(x); px < Math.floor(x + width); px++) {
        if (this._isClipped(px, py)) continue;
        this._setPixel(px, py, color);
      }
    }
  }
  
  strokeRect(x, y, width, height) {
    const color = parseColor(this.strokeStyle);
    const lw = Math.max(1, Math.floor(this.lineWidth));
    
    // Top and bottom
    for (let px = x; px < x + width; px++) {
      for (let i = 0; i < lw; i++) {
        this._setPixel(Math.floor(px), Math.floor(y + i), color);
        this._setPixel(Math.floor(px), Math.floor(y + height - 1 - i), color);
      }
    }
    
    // Left and right
    for (let py = y; py < y + height; py++) {
      for (let i = 0; i < lw; i++) {
        this._setPixel(Math.floor(x + i), Math.floor(py), color);
        this._setPixel(Math.floor(x + width - 1 - i), Math.floor(py), color);
      }
    }
  }
  
  fill() {
    const color = parseColor(this.fillStyle);
    const points = this._pathToPoints();
    this._fillPolygon(points, color);
  }
  
  stroke() {
    const color = parseColor(this.strokeStyle);
    const points = this._pathToPoints();
    this._strokePolygon(points, color);
  }
  
  clip() {
    this._clipPath = this._pathToPoints();
  }
  
  _isClipped(x, y) {
    if (!this._clipPath || this._clipPath.length === 0) return false;
    return !this._pointInPolygon(x, y, this._clipPath);
  }
  
  _pathToPoints() {
    const points = [];
    let currentX = 0, currentY = 0;
    
    for (const cmd of this._path) {
      switch (cmd.type) {
        case 'move':
          currentX = cmd.x;
          currentY = cmd.y;
          points.push({ x: currentX, y: currentY });
          break;
          
        case 'line':
          currentX = cmd.x;
          currentY = cmd.y;
          points.push({ x: currentX, y: currentY });
          break;
          
        case 'arc':
          // Approximate arc with line segments
          const steps = Math.max(8, Math.floor(cmd.radius * Math.abs(cmd.endAngle - cmd.startAngle) / 4));
          for (let i = 0; i <= steps; i++) {
            const angle = cmd.startAngle + (cmd.endAngle - cmd.startAngle) * i / steps;
            points.push({
              x: cmd.x + cmd.radius * Math.cos(angle),
              y: cmd.y + cmd.radius * Math.sin(angle)
            });
          }
          break;
          
        case 'ellipse':
          // Approximate ellipse with line segments
          const ellipseSteps = 32;
          for (let i = 0; i <= ellipseSteps; i++) {
            const angle = cmd.startAngle + (cmd.endAngle - cmd.startAngle) * i / ellipseSteps;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const cosRot = Math.cos(cmd.rotation);
            const sinRot = Math.sin(cmd.rotation);
            points.push({
              x: cmd.x + cmd.radiusX * cos * cosRot - cmd.radiusY * sin * sinRot,
              y: cmd.y + cmd.radiusX * cos * sinRot + cmd.radiusY * sin * cosRot
            });
          }
          break;
      }
    }
    
    return points;
  }
  
  _fillPolygon(points, color) {
    if (points.length < 3) return;
    
    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    
    // Scan fill
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        if (this._isClipped(x, y)) continue;
        if (this._pointInPolygon(x + 0.5, y + 0.5, points)) {
          this._setPixel(x, y, color);
        }
      }
    }
  }
  
  _strokePolygon(points, color) {
    if (points.length < 2) return;
    
    for (let i = 0; i < points.length - 1; i++) {
      this._drawLine(
        Math.floor(points[i].x),
        Math.floor(points[i].y),
        Math.floor(points[i + 1].x),
        Math.floor(points[i + 1].y),
        color
      );
    }
  }
  
  _drawLine(x0, y0, x1, y1, color) {
    // Bresenham's line algorithm
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
      this._setPixel(x0, y0, color);
      
      if (x0 === x1 && y0 === y1) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  
  _pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  
  _setPixel(x, y, color) {
    x = Math.floor(x);
    y = Math.floor(y);
    
    if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return;
    
    const idx = (y * this.canvas.width + x) * 4;
    
    // Alpha blending
    const srcAlpha = color[3] / 255;
    const dstAlpha = this.canvas.pixels[idx + 3] / 255;
    const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
    
    if (outAlpha > 0) {
      this.canvas.pixels[idx] = Math.floor((color[0] * srcAlpha + this.canvas.pixels[idx] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      this.canvas.pixels[idx + 1] = Math.floor((color[1] * srcAlpha + this.canvas.pixels[idx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      this.canvas.pixels[idx + 2] = Math.floor((color[2] * srcAlpha + this.canvas.pixels[idx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      this.canvas.pixels[idx + 3] = Math.floor(outAlpha * 255);
    }
  }
}

/**
 * Parse CSS color string to RGBA array
 */
function parseColor(colorStr) {
  if (colorStr.startsWith('#')) {
    const hex = colorStr.slice(1);
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        255
      ];
    }
  } else if (colorStr.startsWith('rgba(')) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return [
        parseInt(match[1]),
        parseInt(match[2]),
        parseInt(match[3]),
        Math.floor((parseFloat(match[4] || 1)) * 255)
      ];
    }
  } else if (colorStr.startsWith('rgb(')) {
    const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return [
        parseInt(match[1]),
        parseInt(match[2]),
        parseInt(match[3]),
        255
      ];
    }
  }
  
  // Default black
  return [0, 0, 0, 255];
}

/**
 * Encode raw RGBA pixels as PNG buffer
 */
function encodePNG(pixels, width, height) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type (RGBA)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdr);
  
  // IDAT chunk (image data)
  // Add filter byte (0 = none) to each scanline
  const scanlineSize = width * 4 + 1;
  const imageData = Buffer.alloc(scanlineSize * height);
  
  for (let y = 0; y < height; y++) {
    imageData[y * scanlineSize] = 0; // filter type
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * scanlineSize + 1 + x * 4;
      imageData[dstIdx] = pixels[srcIdx];
      imageData[dstIdx + 1] = pixels[srcIdx + 1];
      imageData[dstIdx + 2] = pixels[srcIdx + 2];
      imageData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }
  
  const compressed = zlib.deflateSync(imageData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Create a PNG chunk with CRC
 */
function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * Calculate CRC32 checksum
 */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  
  for (let i = 0; i < buf.length; i++) {
    crc = crc ^ buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function createCanvas(width, height) {
  return new Canvas(width, height);
}
