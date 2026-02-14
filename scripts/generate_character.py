"""
Generate high-quality isometric character sprites
Habbo Hotel style with 4 directional views
Cute proportions, detailed shading, drop shadow
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from pixel_art_helpers import *
from PIL import Image, ImageDraw


def create_character_sprite(direction='south'):
    """
    Create character sprite in given direction
    
    Args:
        direction: 'north', 'south', 'east', 'west' (isometric diagonals)
    
    Returns:
        PIL Image
    """
    W, H = 32, 48
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pixels = img.load()
    draw = ImageDraw.Draw(img)
    
    # Color palettes
    SKIN_TONES = generate_tone_ramp((255, 220, 180, 255), num_tones=3)
    HAIR_TONES = generate_tone_ramp((80, 50, 30, 255), num_tones=3)  # Brown hair
    SHIRT_TONES = generate_tone_ramp((100, 150, 220, 255), num_tones=4)  # Blue shirt
    PANTS_TONES = generate_tone_ramp((60, 60, 80, 255), num_tones=3)  # Dark pants
    
    # Character proportions (Habbo style - big head)
    head_size = 12
    body_height = 16
    leg_height = 16
    
    # Base position (centered)
    center_x = W // 2
    
    # Different poses based on direction
    if direction == 'south':  # Facing front-right (SE in iso)
        # HEAD
        head_center = (center_x + 2, 10)
        
        # Head (circle-ish)
        for x in range(head_center[0] - head_size // 2, head_center[0] + head_size // 2):
            for y in range(head_center[1] - head_size // 2, head_center[1] + head_size // 2):
                dx = abs(x - head_center[0])
                dy = abs(y - head_center[1])
                if dx * dx + dy * dy < (head_size // 2) * (head_size // 2):
                    if 0 <= x < W and 0 <= y < H:
                        # Shading: left side darker
                        if x < head_center[0] - 2:
                            pixels[x, y] = SKIN_TONES[2]
                        elif x < head_center[0]:
                            pixels[x, y] = SKIN_TONES[1]
                        else:
                            pixels[x, y] = SKIN_TONES[0]
        
        # Eyes (two dots)
        eye_y = head_center[1]
        pixels[head_center[0] - 2, eye_y] = (50, 50, 50, 255)
        pixels[head_center[0] + 3, eye_y] = (50, 50, 50, 255)
        
        # Nose (tiny)
        pixels[head_center[0] + 1, eye_y + 2] = SKIN_TONES[2]
        
        # Hair (cap on top and sides)
        hair_top = head_center[1] - head_size // 2
        for x in range(head_center[0] - head_size // 2, head_center[0] + head_size // 2):
            for y in range(hair_top, hair_top + 4):
                if 0 <= x < W and 0 <= y < H and pixels[x, y][3] > 0:
                    pixels[x, y] = HAIR_TONES[1]
        
        # Hair highlight
        for x in range(head_center[0], head_center[0] + 3):
            if 0 <= x < W:
                pixels[x, hair_top + 1] = HAIR_TONES[0]
        
        # BODY (shirt)
        body_top = head_center[1] + head_size // 2
        body_bottom = body_top + body_height
        body_width = 10
        
        # Torso (rounded rectangle)
        for y in range(body_top, body_bottom):
            width_at_y = body_width if y < body_bottom - 4 else body_width - 2
            for x in range(center_x - width_at_y // 2, center_x + width_at_y // 2):
                if 0 <= x < W and 0 <= y < H:
                    # Shading
                    if x < center_x - 2:
                        pixels[x, y] = SHIRT_TONES[2]  # Left side darker
                    elif x < center_x:
                        pixels[x, y] = SHIRT_TONES[1]
                    else:
                        pixels[x, y] = SHIRT_TONES[0]  # Right side lighter
        
        # Shirt highlight (right shoulder)
        for x, y in [(center_x + 3, body_top + 2), (center_x + 4, body_top + 2)]:
            if 0 <= x < W and 0 <= y < H:
                pixels[x, y] = SHIRT_TONES[0]
        
        # LEGS (two visible in front view)
        leg_top = body_bottom
        leg_bottom = leg_top + leg_height
        leg_width = 3
        
        # Right leg (more visible)
        for y in range(leg_top, leg_bottom):
            for x in range(center_x + 1, center_x + 1 + leg_width):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = PANTS_TONES[1]
        
        # Left leg (partially hidden)
        for y in range(leg_top, leg_bottom):
            for x in range(center_x - 3, center_x):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = PANTS_TONES[2]  # Darker
        
        # Shoes (tiny dark rectangles)
        for x in range(center_x - 3, center_x):
            if 0 <= x < W:
                pixels[x, leg_bottom - 2] = (40, 30, 20, 255)
                pixels[x, leg_bottom - 1] = (40, 30, 20, 255)
        
        for x in range(center_x + 1, center_x + 4):
            if 0 <= x < W:
                pixels[x, leg_bottom - 2] = (40, 30, 20, 255)
                pixels[x, leg_bottom - 1] = (40, 30, 20, 255)
    
    elif direction == 'north':  # Facing back-left (NW in iso)
        # Similar structure but back view
        head_center = (center_x - 2, 10)
        
        # Head (back of head)
        for x in range(head_center[0] - head_size // 2, head_center[0] + head_size // 2):
            for y in range(head_center[1] - head_size // 2, head_center[1] + head_size // 2):
                dx = abs(x - head_center[0])
                dy = abs(y - head_center[1])
                if dx * dx + dy * dy < (head_size // 2) * (head_size // 2):
                    if 0 <= x < W and 0 <= y < H:
                        # Back of head - mostly hair
                        pixels[x, y] = HAIR_TONES[1]
        
        # Hair shading
        for x in range(head_center[0] - 2, head_center[0] + 3):
            y = head_center[1] - head_size // 2 + 1
            if 0 <= x < W and 0 <= y < H and pixels[x, y][3] > 0:
                pixels[x, y] = HAIR_TONES[0]
        
        # Tiny bit of skin visible (neck/ear)
        for x, y in [(head_center[0] - 4, head_center[1] + 2),
                     (head_center[0] + 4, head_center[1] + 2)]:
            if 0 <= x < W and 0 <= y < H:
                pixels[x, y] = SKIN_TONES[1]
        
        # BODY (back of shirt)
        body_top = head_center[1] + head_size // 2
        body_bottom = body_top + body_height
        body_width = 10
        
        for y in range(body_top, body_bottom):
            width_at_y = body_width if y < body_bottom - 4 else body_width - 2
            for x in range(center_x - width_at_y // 2, center_x + width_at_y // 2):
                if 0 <= x < W and 0 <= y < H:
                    # Back is in shadow
                    pixels[x, y] = SHIRT_TONES[2]
        
        # LEGS (back view)
        leg_top = body_bottom
        leg_bottom = leg_top + leg_height
        
        # Both legs visible but reversed
        for y in range(leg_top, leg_bottom):
            for x in range(center_x - 3, center_x):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = PANTS_TONES[1]
            for x in range(center_x + 1, center_x + 4):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = PANTS_TONES[2]
        
        # Shoes
        for x in range(center_x - 3, center_x + 4):
            if 0 <= x < W:
                pixels[x, leg_bottom - 2] = (40, 30, 20, 255)
                pixels[x, leg_bottom - 1] = (40, 30, 20, 255)
    
    elif direction == 'east':  # Facing right (NE in iso)
        # Profile view facing right
        head_center = (center_x + 3, 10)
        
        # Head (side profile)
        for x in range(head_center[0] - head_size // 2, head_center[0] + head_size // 2):
            for y in range(head_center[1] - head_size // 2, head_center[1] + head_size // 2 + 1):
                dx = abs(x - head_center[0])
                dy = abs(y - head_center[1])
                if dx * dx + dy * dy < (head_size // 2) * (head_size // 2):
                    if 0 <= x < W and 0 <= y < H:
                        pixels[x, y] = SKIN_TONES[0]  # Lit from right
        
        # Eye (single dot in profile)
        pixels[head_center[0] + 3, head_center[1]] = (50, 50, 50, 255)
        
        # Nose (profile)
        pixels[head_center[0] + 4, head_center[1] + 1] = SKIN_TONES[2]
        pixels[head_center[0] + 5, head_center[1] + 1] = SKIN_TONES[2]
        
        # Hair (top and back)
        hair_top = head_center[1] - head_size // 2
        for x in range(head_center[0] - 4, head_center[0] + 5):
            for y in range(hair_top, hair_top + 5):
                if 0 <= x < W and 0 <= y < H and pixels[x, y][3] > 0:
                    pixels[x, y] = HAIR_TONES[1]
        
        # BODY
        body_top = head_center[1] + head_size // 2
        body_bottom = body_top + body_height
        
        for y in range(body_top, body_bottom):
            for x in range(center_x - 4, center_x + 6):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = SHIRT_TONES[0]
        
        # LEGS (walking pose - one forward)
        leg_top = body_bottom
        leg_bottom = leg_top + leg_height
        
        # Front leg
        for y in range(leg_top, leg_bottom):
            for x in range(center_x + 2, center_x + 5):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = PANTS_TONES[1]
        
        # Back leg (slightly behind)
        for y in range(leg_top + 2, leg_bottom):
            for x in range(center_x - 2, center_x + 1):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = PANTS_TONES[2]
        
        # Shoes
        for x in range(center_x + 2, center_x + 6):
            pixels[x, leg_bottom - 1] = (40, 30, 20, 255)
    
    else:  # 'west' - Facing left (SW in iso)
        # Mirror of east
        head_center = (center_x - 3, 10)
        
        # Head
        for x in range(head_center[0] - head_size // 2, head_center[0] + head_size // 2):
            for y in range(head_center[1] - head_size // 2, head_center[1] + head_size // 2 + 1):
                dx = abs(x - head_center[0])
                dy = abs(y - head_center[1])
                if dx * dx + dy * dy < (head_size // 2) * (head_size // 2):
                    if 0 <= x < W and 0 <= y < H:
                        pixels[x, y] = SKIN_TONES[1]  # In shadow
        
        # Eye
        pixels[head_center[0] - 3, head_center[1]] = (50, 50, 50, 255)
        
        # Nose
        pixels[head_center[0] - 4, head_center[1] + 1] = SKIN_TONES[2]
        
        # Hair
        hair_top = head_center[1] - head_size // 2
        for x in range(head_center[0] - 5, head_center[0] + 4):
            for y in range(hair_top, hair_top + 5):
                if 0 <= x < W and 0 <= y < H and pixels[x, y][3] > 0:
                    pixels[x, y] = HAIR_TONES[2]  # Darker
        
        # BODY
        body_top = head_center[1] + head_size // 2
        body_bottom = body_top + body_height
        
        for y in range(body_top, body_bottom):
            for x in range(center_x - 6, center_x + 4):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = SHIRT_TONES[2]  # Darker
        
        # LEGS
        leg_top = body_bottom
        leg_bottom = leg_top + leg_height
        
        # Front leg
        for y in range(leg_top, leg_bottom):
            for x in range(center_x - 5, center_x - 2):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = PANTS_TONES[1]
        
        # Back leg
        for y in range(leg_top + 2, leg_bottom):
            for x in range(center_x - 1, center_x + 2):
                if 0 <= x < W and 0 <= y < H:
                    pixels[x, y] = PANTS_TONES[2]
        
        # Shoes
        for x in range(center_x - 6, center_x - 2):
            pixels[x, leg_bottom - 1] = (40, 30, 20, 255)
    
    # Add black outlines around character
    add_black_outline(img, outline_width=1)
    
    # Add drop shadow (oval blob underneath)
    shadow_y = H - 3
    shadow_polygon = [
        (center_x - 8, shadow_y),
        (center_x + 8, shadow_y),
        (center_x + 7, shadow_y + 2),
        (center_x - 7, shadow_y + 2),
    ]
    add_cast_shadow(img, shadow_polygon, (0, 0, 0, 120))
    
    return img


def main():
    output_dir = "../client/public/assets"
    os.makedirs(output_dir, exist_ok=True)
    
    print("🧍 Generating professional isometric character sprites...\n")
    
    directions = {
        'south': 'char_south.png',  # Front-right (SE)
        'north': 'char_north.png',  # Back-left (NW)
        'east': 'char_east.png',    # Right (NE)
        'west': 'char_west.png',    # Left (SW)
    }
    
    sprites = {}
    
    for direction, filename in directions.items():
        print(f"👤 Creating {direction} view...")
        char_img = create_character_sprite(direction)
        filepath = f"{output_dir}/{filename}"
        char_img.save(filepath, 'PNG')
        sprites[direction] = char_img
        file_size = os.path.getsize(filepath)
        print(f"   ✓ {filename} ({file_size} bytes)")
    
    # Create spritesheet (all 4 directions in a row)
    print("\n📋 Creating character spritesheet...")
    sheet_width = 32 * 4  # 4 sprites
    sheet_height = 48
    
    spritesheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))
    
    positions = {
        'south': 0,
        'north': 32,
        'east': 64,
        'west': 96,
    }
    
    for direction, x_pos in positions.items():
        spritesheet.paste(sprites[direction], (x_pos, 0), sprites[direction])
    
    sheet_path = f"{output_dir}/character_spritesheet.png"
    spritesheet.save(sheet_path, 'PNG')
    file_size = os.path.getsize(sheet_path)
    print(f"   ✓ character_spritesheet.png ({file_size} bytes)")
    
    print("\n✅ Character sprites complete! Cute Habbo-style proportions with detail.\n")


if __name__ == "__main__":
    main()
