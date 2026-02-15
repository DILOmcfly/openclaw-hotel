#!/usr/bin/env python3
"""Reprocess sprites v2: clean up flood-fill artifacts from _clean files.

The _clean files have binary alpha (0 or 255) from crude flood-fill.
Problems: jagged edges, stray transparent holes, background remnants.

Fix strategy:
1. Load high-res _clean version 
2. Morphological close to fill small holes in alpha
3. Morphological erode to eat away 1-2px of edge (removes fringe)
4. Dilate back to restore size (but with clean edges)
5. Downscale with LANCZOS (anti-aliased)
6. Clean up alpha: threshold to binary for pixel-art crispness
"""

import os
import sys
import numpy as np
from PIL import Image, ImageFilter

SRC_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'generated', 'furniture')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'room-sprites')

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


def morphological_op(alpha, operation='erode', radius=2):
    """Apply morphological erosion or dilation using PIL."""
    # Convert to PIL Image for filter operations
    mask = Image.fromarray(alpha)
    if operation == 'erode':
        mask = mask.filter(ImageFilter.MinFilter(radius * 2 + 1))
    elif operation == 'dilate':
        mask = mask.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    elif operation == 'close':
        # Close = dilate then erode (fills small holes)
        mask = mask.filter(ImageFilter.MaxFilter(radius * 2 + 1))
        mask = mask.filter(ImageFilter.MinFilter(radius * 2 + 1))
    elif operation == 'open':
        # Open = erode then dilate (removes small noise)
        mask = mask.filter(ImageFilter.MinFilter(radius * 2 + 1))
        mask = mask.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    return np.array(mask)


def clean_alpha(img):
    """Clean up the alpha channel of a flood-fill processed image."""
    arr = np.array(img.convert('RGBA'))
    alpha = arr[:,:,3].copy()
    
    # Step 1: Close small holes (radius 3 at high-res)
    alpha = morphological_op(alpha, 'close', radius=3)
    
    # Step 2: Open to remove small noise/artifacts (radius 2)
    alpha = morphological_op(alpha, 'open', radius=2)
    
    # Step 3: Slight erode to eat away fringe (radius 1)
    alpha = morphological_op(alpha, 'erode', radius=1)
    
    # Step 4: Ensure binary (no semi-transparent at high res)
    alpha = np.where(alpha > 128, 255, 0).astype(np.uint8)
    
    arr[:,:,3] = alpha
    return Image.fromarray(arr)


def trim_to_content(img, padding=8):
    """Crop to content bounding box."""
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


def downscale_crisp(img, target_size):
    """Downscale with LANCZOS then binarize alpha for crisp pixel art."""
    resized = img.resize(target_size, Image.Resampling.LANCZOS)
    arr = np.array(resized)
    # Binarize alpha for crisp edges
    arr[:,:,3] = np.where(arr[:,:,3] > 100, 255, 0).astype(np.uint8)
    return Image.fromarray(arr)


def process(name, src_file, target_size):
    src_path = os.path.join(SRC_DIR, src_file)
    out_path = os.path.join(OUT_DIR, f'{name}.png')
    
    if not os.path.exists(src_path):
        print(f"  ⚠️  Missing: {src_file}")
        return False
    
    img = Image.open(src_path)
    print(f"  {name}: {img.size} → ", end='')
    
    # Clean alpha
    cleaned = clean_alpha(img)
    
    # Trim
    trimmed = trim_to_content(cleaned)
    
    # Downscale
    final = downscale_crisp(trimmed, target_size)
    
    final.save(out_path, 'PNG')
    fsize = os.path.getsize(out_path)
    print(f"{final.size} ({fsize} bytes) ✅")
    return True


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    items = sys.argv[1:] if len(sys.argv) > 1 else list(SPRITE_MAP.keys())
    ok = 0
    for item in items:
        if item in SPRITE_MAP:
            src, size = SPRITE_MAP[item]
            if process(item, src, size):
                ok += 1
    print(f"\nDone: {ok}/{len(items)}")
