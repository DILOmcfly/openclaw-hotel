#!/usr/bin/env python3
"""Generate pixel art sprites with green chroma background via Gemini API,
then cleanly remove the green background using color-distance keying."""

import sys
import os
import requests
import base64
import json
from PIL import Image
import numpy as np
from io import BytesIO

API_KEY = open(os.path.expanduser('~/.gemini-api-key' if os.path.exists(os.path.expanduser('~/.gemini-api-key')) else os.path.join(os.path.dirname(__file__), '..', '..', '..', '.gemini-api-key'))).read().strip()

# Gemini API endpoint for image generation
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={API_KEY}"

def generate_sprite(item_name, description, width=128, height=128):
    """Generate a sprite with solid green (#00FF00) chroma background."""
    
    prompt = f"""Create a pixel art isometric {description} for a Habbo Hotel style game.
CRITICAL RULES:
- Background must be SOLID PURE GREEN (#00FF00) - no gradients, no patterns, FLAT GREEN
- The {item_name} should be drawn in classic Habbo Hotel pixel art style
- Isometric 2:1 perspective (26.5 degree angle)
- Bold black 1px outlines around the object
- Flat colors with minimal shading (1-2 shadow tones max)
- The object should be centered in the image
- NO shadows on the ground
- NO reflections
- The green background (#00FF00) must be completely uniform around the object
- Image size: {width}x{height} pixels"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"]
        }
    }

    print(f"Generating {item_name}...")
    resp = requests.post(API_URL, json=payload, timeout=60)
    
    if resp.status_code != 200:
        print(f"API Error {resp.status_code}: {resp.text[:200]}")
        return None
    
    data = resp.json()
    
    # Extract image from response
    for candidate in data.get('candidates', []):
        for part in candidate.get('content', {}).get('parts', []):
            if 'inlineData' in part:
                img_data = base64.b64decode(part['inlineData']['data'])
                img = Image.open(BytesIO(img_data))
                print(f"  Got image: {img.size}, mode={img.mode}")
                return img
    
    print("No image in response")
    return None


def chroma_key_remove(img, target_color=(0, 255, 0), tolerance=60):
    """Remove green chroma background with clean edges."""
    
    img = img.convert('RGBA')
    data = np.array(img, dtype=np.float32)
    
    # Calculate color distance from target green
    r_diff = data[:,:,0] - target_color[0]
    g_diff = data[:,:,1] - target_color[1]
    b_diff = data[:,:,2] - target_color[2]
    
    distance = np.sqrt(r_diff**2 + g_diff**2 + b_diff**2)
    
    # Create alpha mask: 0 where green, 255 where not green
    alpha = np.where(distance < tolerance, 0, 255).astype(np.uint8)
    
    # Smooth transition zone for anti-aliasing
    transition_mask = (distance >= tolerance) & (distance < tolerance + 30)
    alpha[transition_mask] = ((distance[transition_mask] - tolerance) / 30 * 255).clip(0, 255).astype(np.uint8)
    
    # Apply alpha
    result = np.array(img)
    result[:,:,3] = alpha
    
    # Clean green fringe from edge pixels (despill)
    edge_mask = (alpha > 0) & (alpha < 255)
    if edge_mask.any():
        # Reduce green channel on edge pixels
        green_excess = result[:,:,1].astype(float) - (result[:,:,0].astype(float) + result[:,:,2].astype(float)) / 2
        green_excess = np.clip(green_excess, 0, None)
        result[:,:,1] = np.where(edge_mask, 
            (result[:,:,1].astype(float) - green_excess * 0.7).clip(0, 255),
            result[:,:,1]).astype(np.uint8)
    
    return Image.fromarray(result)


def trim_transparent(img, padding=2):
    """Crop to content bounding box with small padding."""
    data = np.array(img)
    alpha = data[:,:,3]
    rows = np.any(alpha > 0, axis=1)
    cols = np.any(alpha > 0, axis=0)
    
    if not rows.any():
        return img
    
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    
    rmin = max(0, rmin - padding)
    rmax = min(data.shape[0], rmax + padding + 1)
    cmin = max(0, cmin - padding)
    cmax = min(data.shape[1], cmax + padding + 1)
    
    return img.crop((cmin, rmin, cmax, rmax))


if __name__ == '__main__':
    # Furniture items to generate
    SPRITES = {
        'sofa': ('couch/sofa seen from above-right isometric view, blue upholstery, wooden legs', 128, 96),
        'table': ('small wooden coffee table, round or rectangular, wood grain texture', 96, 64),
        'chair': ('wooden dining chair with cushion seat, seen from isometric view', 64, 96),
        'lamp': ('tall standing floor lamp with warm yellow shade', 48, 128),
        'tv': ('flat screen TV on a small wooden stand/cabinet', 96, 96),
        'bookshelf': ('tall wooden bookshelf filled with colorful books', 64, 128),
        'computer': ('desktop computer with monitor, keyboard, on a desk', 96, 96),
        'fridge': ('white/silver kitchen refrigerator', 64, 96),
        'plant': ('potted green plant in terracotta pot, small decorative', 48, 64),
        'rug': ('ornamental rectangular rug with decorative pattern, red/burgundy tones', 128, 64),
        'painting': ('framed landscape painting hanging on wall, ornate gold frame', 64, 64),
        'door': ('wooden door with frame and handle, slightly ajar', 64, 128),
        'bed': ('single bed with white sheets and pillow, wooden frame', 128, 96),
    }
    
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'room-sprites')
    os.makedirs(output_dir, exist_ok=True)
    
    items = sys.argv[1:] if len(sys.argv) > 1 else list(SPRITES.keys())
    
    for item in items:
        if item not in SPRITES:
            print(f"Unknown item: {item}")
            continue
        
        desc, w, h = SPRITES[item]
        img = generate_sprite(item, desc, w, h)
        
        if img is None:
            print(f"  FAILED to generate {item}")
            continue
        
        # Save raw (with green bg) for reference
        raw_path = os.path.join(output_dir, f'{item}_raw.png')
        img.save(raw_path)
        print(f"  Saved raw: {raw_path}")
        
        # Chroma key removal
        clean = chroma_key_remove(img)
        clean = trim_transparent(clean)
        
        out_path = os.path.join(output_dir, f'{item}.png')
        clean.save(out_path)
        print(f"  Saved clean: {out_path} ({clean.size[0]}x{clean.size[1]})")
        print(f"  ✅ {item} done!")
