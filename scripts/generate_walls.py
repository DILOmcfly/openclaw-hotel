"""
Generate high-quality isometric wall tiles
With moldures, textures, and proper shading
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from pixel_art_helpers import *
from PIL import Image, ImageDraw

def main():
    output_dir = "../client/public/assets"
    os.makedirs(output_dir, exist_ok=True)
    
    # Wall dimensions (64 width, 96 height for nice proportions)
    WALL_W = 64
    WALL_H = 96
    
    print("🧱 Generating professional isometric wall tiles...")
    print(f"   Target: {WALL_W}x{WALL_H} pixels\n")
    
    # Wall color palette (soft beige/cream wall)
    WALL_TONES = [
        (245, 235, 220, 255),  # Highlight (light cream)
        (220, 210, 195, 255),  # Base
        (180, 170, 155, 255),  # Shadow
        (140, 130, 115, 255),  # Deep shadow
    ]
    
    MOLDING_TONES = [
        (255, 255, 255, 255),  # White highlight
        (230, 230, 230, 255),  # Base
        (180, 180, 180, 255),  # Shadow
        (120, 120, 120, 255),  # Deep shadow
    ]
    
    # ========================================================================
    # 1. LEFT WALL (Right face in isometric view)
    # ========================================================================
    print("◣ Creating left wall...")
    
    left_img = Image.new('RGBA', (WALL_W, WALL_H), (0, 0, 0, 0))
    pixels = left_img.load()
    
    # Left wall shape (parallelogram - left face of cube)
    # Top-left corner, going down vertically and along -2:1 diagonal
    
    top_left = (4, 8)  # Start point
    wall_width_iso = 28  # Depth in isometric units
    
    # Define corners
    tl = top_left
    tr = (tl[0] - wall_width_iso * 2, tl[1] + wall_width_iso)  # Top-right (iso left)
    bl = (tl[0], tl[1] + WALL_H - 16)  # Bottom-left
    br = (tr[0], tr[1] + WALL_H - 16)  # Bottom-right
    
    wall_face = [tl, tr, br, bl]
    
    # Fill with base color
    fill_polygon(left_img, wall_face, WALL_TONES[1])
    
    # Add subtle wall texture (painted wall with very slight variation)
    import random
    random.seed(100)
    
    for y in range(WALL_H):
        for x in range(WALL_W):
            if pixels[x, y][3] > 0:
                if random.random() < 0.15:  # 15% chance of variation
                    tone_choice = random.choice([0, 2])  # Lighter or darker
                    pixels[x, y] = WALL_TONES[tone_choice]
    
    # Add shading (left face is in shadow, right edge is darker)
    for y in range(WALL_H):
        for x in range(WALL_W):
            if pixels[x, y][3] > 0:
                # Darken as we move left (away from light)
                if x < WALL_W // 3:
                    pixels[x, y] = WALL_TONES[2]
    
    # Add molding at bottom (baseboard)
    molding_height = 8
    for y in range(bl[1] - molding_height, bl[1]):
        # Draw molding strip
        for x in range(int(br[0]), int(bl[0])):
            check_y = y - (bl[1] - molding_height)
            if 0 <= x < WALL_W and 0 <= y < WALL_H:
                if check_y < molding_height // 2:
                    pixels[x, y] = MOLDING_TONES[0]  # Highlight
                else:
                    pixels[x, y] = MOLDING_TONES[1]  # Base
    
    # Black outline
    draw = ImageDraw.Draw(left_img)
    draw.polygon(wall_face, outline=(0, 0, 0, 255))
    
    left_path = f"{output_dir}/wall_left.png"
    left_img.save(left_path, 'PNG')
    file_size = os.path.getsize(left_path)
    print(f"   ✓ wall_left.png ({file_size} bytes)")
    
    # ========================================================================
    # 2. RIGHT WALL (Left face in isometric view - lighter)
    # ========================================================================
    print("◢ Creating right wall...")
    
    right_img = Image.new('RGBA', (WALL_W, WALL_H), (0, 0, 0, 0))
    pixels = right_img.load()
    
    # Right wall (lighter, receives more light)
    top_right_start = (WALL_W - 4, 8)
    
    tl_r = (top_right_start[0] + wall_width_iso * 2, top_right_start[1] + wall_width_iso)
    tr_r = top_right_start
    bl_r = (tl_r[0], tl_r[1] + WALL_H - 16)
    br_r = (tr_r[0], tr_r[1] + WALL_H - 16)
    
    wall_face_right = [tl_r, tr_r, br_r, bl_r]
    
    # Fill with lighter shade (receives light)
    fill_polygon(right_img, wall_face_right, WALL_TONES[0])
    
    # Add texture
    random.seed(101)
    pixels_r = right_img.load()
    
    for y in range(WALL_H):
        for x in range(WALL_W):
            if pixels_r[x, y][3] > 0:
                if random.random() < 0.12:
                    pixels_r[x, y] = WALL_TONES[1]  # Slightly darker variation
    
    # Molding
    for y in range(int(br_r[1]) - molding_height, int(br_r[1])):
        for x in range(int(br_r[0]), int(bl_r[0])):
            check_y = y - (int(br_r[1]) - molding_height)
            if 0 <= x < WALL_W and 0 <= y < WALL_H:
                if check_y < molding_height // 2:
                    pixels_r[x, y] = MOLDING_TONES[0]
                else:
                    pixels_r[x, y] = MOLDING_TONES[2]  # Slightly darker
    
    # Outline
    draw_r = ImageDraw.Draw(right_img)
    draw_r.polygon(wall_face_right, outline=(0, 0, 0, 255))
    
    right_path = f"{output_dir}/wall_right.png"
    right_img.save(right_path, 'PNG')
    file_size = os.path.getsize(right_path)
    print(f"   ✓ wall_right.png ({file_size} bytes)")
    
    # ========================================================================
    # 3. CORNER WALL (Intersection of two walls)
    # ========================================================================
    print("🔲 Creating corner wall...")
    
    corner_img = Image.new('RGBA', (WALL_W, WALL_H), (0, 0, 0, 0))
    
    # Combine left and right walls in corner configuration
    # Left face (in shadow)
    tl_c = (WALL_W // 2, 4)
    tr_c = (tl_c[0] - 20, tl_c[1] + 10)
    bl_c = (tl_c[0], tl_c[1] + WALL_H - 12)
    br_c = (tr_c[0], tr_c[1] + WALL_H - 12)
    
    left_face_corner = [tl_c, tr_c, br_c, bl_c]
    fill_polygon(corner_img, left_face_corner, WALL_TONES[2])  # Darker
    
    # Right face (in light)
    tl_c_r = (tl_c[0] + 20, tl_c[1] + 10)
    tr_c_r = tl_c
    bl_c_r = (tl_c_r[0], tl_c_r[1] + WALL_H - 12)
    br_c_r = (tr_c_r[0], tr_c_r[1] + WALL_H - 12)
    
    right_face_corner = [tl_c_r, tr_c_r, br_c_r, bl_c_r]
    fill_polygon(corner_img, right_face_corner, WALL_TONES[0])  # Lighter
    
    # Outlines
    draw_c = ImageDraw.Draw(corner_img)
    draw_c.polygon(left_face_corner, outline=(0, 0, 0, 255))
    draw_c.polygon(right_face_corner, outline=(0, 0, 0, 255))
    
    # Central edge (where two walls meet)
    draw_c.line([tl_c, bl_c], fill=(0, 0, 0, 255), width=1)
    
    corner_path = f"{output_dir}/wall_corner.png"
    corner_img.save(corner_path, 'PNG')
    file_size = os.path.getsize(corner_path)
    print(f"   ✓ wall_corner.png ({file_size} bytes)")
    
    print("\n✅ Wall tiles complete!\n")


if __name__ == "__main__":
    main()
