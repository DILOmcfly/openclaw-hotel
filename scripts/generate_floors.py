"""
Generate high-quality isometric floor tiles
Superior to Habbo Hotel quality with rich textures and shading
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from pixel_art_helpers import *
from PIL import Image

def main():
    output_dir = "../client/public/assets"
    os.makedirs(output_dir, exist_ok=True)
    
    # Tile dimensions (64x32 isometric diamond)
    TILE_W, TILE_H = 64, 32
    
    print("🎨 Generating professional isometric floor tiles...")
    print(f"   Target: {TILE_W}x{TILE_H} pixels, 1-3 KB each\n")
    
    # ========================================================================
    # 1. PLAIN WOOD FLOOR
    # ========================================================================
    print("🪵 Creating wood floor...")
    wood_img = create_floor_tile(
        TILE_W, TILE_H,
        WOOD_TONES,
        'wood',
        texture_seed=42
    )
    
    # Additional detail: subtle plank divisions
    draw = ImageDraw.Draw(wood_img)
    # Horizontal plank line (middle of tile)
    plank_color = WOOD_TONES[2]  # Darker tone
    for x in range(TILE_W // 4, 3 * TILE_W // 4):
        y = TILE_H // 2
        if wood_img.getpixel((x, y))[3] > 0:  # Only draw on tile
            draw.point((x, y), fill=plank_color)
    
    wood_path = f"{output_dir}/floor_wood.png"
    wood_img.save(wood_path, 'PNG')
    file_size = os.path.getsize(wood_path)
    print(f"   ✓ floor_wood.png ({file_size} bytes)")
    
    # ========================================================================
    # 2. CARPET FLOOR (with decorative pattern)
    # ========================================================================
    print("🟥 Creating carpet floor...")
    carpet_img = create_floor_tile(
        TILE_W, TILE_H,
        CARPET_RED_TONES,
        'carpet_diamond',
        texture_seed=123
    )
    
    carpet_path = f"{output_dir}/floor_carpet.png"
    carpet_img.save(carpet_path, 'PNG')
    file_size = os.path.getsize(carpet_path)
    print(f"   ✓ floor_carpet.png ({file_size} bytes)")
    
    # ========================================================================
    # 3. MARBLE FLOOR (with elegant veins)
    # ========================================================================
    print("⬜ Creating marble floor...")
    marble_img = create_floor_tile(
        TILE_W, TILE_H,
        MARBLE_TONES,
        'marble',
        texture_seed=456
    )
    
    # Add specular highlights (shiny marble)
    highlight_points = [
        (TILE_W // 2 + 8, TILE_H // 2 - 4),
        (TILE_W // 2 - 6, TILE_H // 2 + 3),
        (TILE_W // 2 + 15, TILE_H // 2 + 1),
    ]
    add_specular_highlight(marble_img, highlight_points, (255, 255, 255, 180))
    
    marble_path = f"{output_dir}/floor_marble.png"
    marble_img.save(marble_path, 'PNG')
    file_size = os.path.getsize(marble_path)
    print(f"   ✓ floor_marble.png ({file_size} bytes)")
    
    # ========================================================================
    # 4. GRASS TILE (organic texture)
    # ========================================================================
    print("🌱 Creating grass tile...")
    grass_img = create_floor_tile(
        TILE_W, TILE_H,
        GRASS_TONES,
        'grass',
        texture_seed=789
    )
    
    # Add tiny grass blade details
    pixels = grass_img.load()
    import random
    random.seed(789)
    
    for _ in range(20):  # 20 tiny grass blades
        x = random.randint(TILE_W // 4, 3 * TILE_W // 4)
        y = random.randint(TILE_H // 4, 3 * TILE_H // 4)
        
        if grass_img.getpixel((x, y))[3] > 0:
            # Draw tiny 1-2 pixel blade
            pixels[x, y] = GRASS_TONES[0]  # Light green highlight
            if y + 1 < TILE_H:
                pixels[x, y + 1] = GRASS_TONES[1]
    
    grass_path = f"{output_dir}/floor_grass.png"
    grass_img.save(grass_path, 'PNG')
    file_size = os.path.getsize(grass_path)
    print(f"   ✓ floor_grass.png ({file_size} bytes)")
    
    # ========================================================================
    # BONUS: Checker floor (for variety)
    # ========================================================================
    print("⬛ Creating checker floor...")
    
    # Checker uses two-tone marble
    checker_tones = [
        (240, 240, 240, 255),  # White square
        (180, 180, 180, 255),  # Light gray
        (100, 100, 100, 255),  # Dark gray square
        (60, 60, 60, 255),     # Darker gray
    ]
    
    checker_img = Image.new('RGBA', (TILE_W, TILE_H), (0, 0, 0, 0))
    
    # Diamond shape
    top = (TILE_W // 2, 0)
    right = (TILE_W - 1, TILE_H // 2)
    bottom = (TILE_W // 2, TILE_H - 1)
    left = (0, TILE_H // 2)
    diamond = [top, right, bottom, left]
    
    # Split into two triangles (checker pattern)
    # Top-right triangle (white)
    top_right_tri = [top, right, bottom]
    fill_polygon(checker_img, top_right_tri, checker_tones[0])
    
    # Bottom-left triangle (dark)
    bottom_left_tri = [top, bottom, left]
    fill_polygon(checker_img, bottom_left_tri, checker_tones[2])
    
    # Add shading to each triangle
    pixels = checker_img.load()
    
    # Shade bottom edges darker
    for x in range(TILE_W):
        for y in range(TILE_H // 2, TILE_H):
            if pixels[x, y][3] > 0:
                current = pixels[x, y]
                if current == checker_tones[0]:
                    # White triangle: add slight shadow at bottom
                    if y > 3 * TILE_H // 4:
                        pixels[x, y] = checker_tones[1]
                elif current == checker_tones[2]:
                    # Dark triangle: make bottom even darker
                    if y > 3 * TILE_H // 4:
                        pixels[x, y] = checker_tones[3]
    
    # Black outline
    draw = ImageDraw.Draw(checker_img)
    draw.polygon(diamond, outline=(0, 0, 0, 255))
    
    checker_path = f"{output_dir}/floor_checker.png"
    checker_img.save(checker_path, 'PNG')
    file_size = os.path.getsize(checker_path)
    print(f"   ✓ floor_checker.png ({file_size} bytes)")
    
    print("\n✅ Floor tiles complete! All tiles should be 1+ KB with rich detail.\n")


if __name__ == "__main__":
    main()
