#!/usr/bin/env python3
"""Reprocess all furniture sprites from high-res originals with proper background removal.

Strategy:
1. Sample corners to detect background color
2. Use color-distance based alpha masking (not flood-fill!)
3. Edge refinement: remove halos by despilling background color
4. Trim to content bounding box
5. Downscale using NEAREST for pixel-art crispness
"""

import os
import sys
import numpy as np
from PIL import Image

SRC_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'generated', 'furniture')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'room-sprites')

# Map from output name to source file and target size
SPRITE_MAP = {
    'sofa': ('sofa_blue_clean.png', (128, 96)),
    'table': ('table_wood_clean.png', (96, 64)),
    'chair': ('chair_wood_clean.png', (64, 96)),
    'lamp': ('lamp_clean.png', (48, 128)),
    'tv': ('tv_retro_clean.png', (96, 96)),
    'bookshelf': ('bookshelf_clean.png', (64, 128)),
    'computer': ('computer_clean.png', (96, 96)),
    'fridge': ('fridge_clean.png', (64, 96)),
    'plant': ('plant_clean.png', (48, 64)),
    'rug': ('rug_clean.png', (128, 64)),
    'painting': ('painting_clean.png', (64, 64)),
    'door': ('door_clean.png', (64, 128)),
    'bed': ('bed_clean.png', (128, 96)),
}


def detect_bg_color(img_array):
    """Sample corners to detect the most common background color."""
    h, w = img_array.shape[:2]
    corners = []
    size = min(20, h//4, w//4)
    # Sample 4 corners
    for sy, sx in [(0,0), (0,w-size), (h-size,0), (h-size,w-size)]:
        region = img_array[sy:sy+size, sx:sx+size, :3]
        for row in region:
            for px in row:
                corners.append(tuple(px))
    
    # Find most common color
    from collections import Counter
    c = Counter(corners)
    bg_color = c.most_common(1)[0][0]
    print(f"    Detected BG color: RGB{bg_color}")
    return np.array(bg_color, dtype=np.float32)


def remove_background(img, tolerance=45, edge_feather=20):
    """Remove background using color-distance masking with edge feathering."""
    arr = np.array(img.convert('RGBA'), dtype=np.uint8)
    rgb = arr[:,:,:3].astype(np.float32)
    
    bg = detect_bg_color(arr)
    
    # Color distance from background
    diff = rgb - bg
    dist = np.sqrt(np.sum(diff**2, axis=2))
    
    # Create alpha: sharp cutoff with feathered edges
    alpha = np.ones(dist.shape, dtype=np.float32)
    alpha[dist < tolerance] = 0.0
    
    # Feather zone
    feather_mask = (dist >= tolerance) & (dist < tolerance + edge_feather)
    alpha[feather_mask] = (dist[feather_mask] - tolerance) / edge_feather
    
    # Despill: remove background color contamination from edge pixels
    semi_transparent = (alpha > 0.0) & (alpha < 0.9)
    if semi_transparent.any():
        # Calculate how much of the pixel color is from the background
        for c in range(3):
            channel = arr[:,:,c].astype(np.float32)
            bg_contribution = bg[c] * (1.0 - alpha)
            corrected = (channel - bg_contribution) / np.maximum(alpha, 0.01)
            corrected = np.clip(corrected, 0, 255)
            arr[:,:,c] = np.where(semi_transparent, corrected.astype(np.uint8), arr[:,:,c])
    
    # Apply alpha
    arr[:,:,3] = (alpha * 255).clip(0, 255).astype(np.uint8)
    
    return Image.fromarray(arr)


def trim_to_content(img, padding=4):
    """Crop to bounding box of non-transparent pixels."""
    arr = np.array(img)
    alpha = arr[:,:,3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    
    if not rows.any():
        return img
    
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    
    rmin = max(0, rmin - padding)
    rmax = min(arr.shape[0], rmax + padding + 1)
    cmin = max(0, cmin - padding)
    cmax = min(arr.shape[1], cmax + padding + 1)
    
    return img.crop((cmin, rmin, cmax, rmax))


def downscale_pixel_art(img, target_size):
    """Downscale for pixel art — use LANCZOS for initial downscale, then quantize."""
    # First resize to target
    resized = img.resize(target_size, Image.Resampling.LANCZOS)
    
    # Sharpen alpha: make semi-transparent pixels either fully opaque or fully transparent
    arr = np.array(resized)
    alpha = arr[:,:,3]
    # Threshold at 128
    arr[:,:,3] = np.where(alpha > 80, 255, 0).astype(np.uint8)
    
    return Image.fromarray(arr)


def process_sprite(name, src_file, target_size):
    src_path = os.path.join(SRC_DIR, src_file)
    out_path = os.path.join(OUT_DIR, f'{name}.png')
    
    if not os.path.exists(src_path):
        print(f"  ⚠️  Source not found: {src_file}")
        return False
    
    print(f"  Processing {name} from {src_file}...")
    img = Image.open(src_path)
    print(f"    Source: {img.size} {img.mode}")
    
    # Step 1: Remove background
    clean = remove_background(img)
    
    # Step 2: Trim
    trimmed = trim_to_content(clean)
    print(f"    Trimmed: {trimmed.size}")
    
    # Step 3: Downscale
    final = downscale_pixel_art(trimmed, target_size)
    print(f"    Final: {final.size}")
    
    # Step 4: Save
    final.save(out_path, 'PNG')
    
    # Verify
    fsize = os.path.getsize(out_path)
    print(f"    ✅ Saved: {out_path} ({fsize} bytes)")
    return True


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    
    items = sys.argv[1:] if len(sys.argv) > 1 else list(SPRITE_MAP.keys())
    
    success = 0
    for item in items:
        if item not in SPRITE_MAP:
            print(f"Unknown: {item}")
            continue
        src, size = SPRITE_MAP[item]
        if process_sprite(item, src, size):
            success += 1
    
    print(f"\n{'='*40}")
    print(f"Processed {success}/{len(items)} sprites")
