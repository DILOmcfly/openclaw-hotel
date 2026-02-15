#!/usr/bin/env python3
"""Process a Gemini-generated pixel art asset: remove checkerboard bg, crop, resize."""
import sys
from PIL import Image
from collections import deque
from pathlib import Path

def flood_fill_remove_bg(img, tolerance=15, min_gray=40):
    """Remove background by flood-filling from edges."""
    w, h = img.size
    pixels = img.load()
    visited = set()
    queue = deque()
    
    # Start from all border pixels
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h-1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w-1, y))
    
    def is_bg(r, g, b, a):
        if a < 128:
            return True
        # White or near-white
        if r > 240 and g > 240 and b > 240:
            return True
        # Gray checkerboard pattern
        if abs(r-g) < tolerance and abs(g-b) < tolerance and r > min_gray:
            return True
        return False
    
    count = 0
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        visited.add((x, y))
        r, g, b, a = pixels[x, y]
        if is_bg(r, g, b, a):
            pixels[x, y] = (0, 0, 0, 0)
            count += 1
            for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
                nx, ny = x+dx, y+dy
                if (nx, ny) not in visited:
                    queue.append((nx, ny))
    return img, count

def process_asset(input_path, output_name, output_dir, sizes=None):
    """Process a raw Gemini asset into game-ready PNGs."""
    img = Image.open(input_path).convert("RGBA")
    print(f"Input: {img.size}")
    
    img, removed = flood_fill_remove_bg(img)
    print(f"Removed {removed} bg pixels")
    
    bbox = img.split()[3].getbbox()
    if not bbox:
        print("ERROR: No content found after bg removal!")
        return
    
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    print(f"Cropped: {cw}x{ch}")
    
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    
    # Save clean full-res
    cropped.save(out / f"{output_name}_clean.png")
    
    # Save requested sizes
    if sizes:
        for sw, sh in sizes:
            resized = cropped.resize((sw, sh), Image.NEAREST)
            resized.save(out / f"{output_name}_{sw}x{sh}.png")
            print(f"Saved: {output_name}_{sw}x{sh}.png")
    
    print("Done!")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: process-asset.py <input.png> <output_name> <output_dir> [WxH WxH ...]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_name = sys.argv[2]
    output_dir = sys.argv[3]
    sizes = []
    for s in sys.argv[4:]:
        w, h = s.split("x")
        sizes.append((int(w), int(h)))
    
    process_asset(input_path, output_name, output_dir, sizes)
