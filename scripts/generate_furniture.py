"""
Generate high-quality isometric furniture
With proper shading, textures, cast shadows, and special effects
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from pixel_art_helpers import *
from PIL import Image, ImageDraw
import random


def create_chair():
    """Create an isometric chair with cushion and shadow"""
    W, H = 32, 40
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pixels = img.load()
    draw = ImageDraw.Draw(img)
    
    # Chair color (warm red cushion)
    CUSHION_TONES = generate_tone_ramp((180, 60, 60, 255), num_tones=4)
    WOOD_FRAME = generate_tone_ramp((101, 67, 33, 255), num_tones=3)
    
    # Seat (cushioned, rounded look)
    seat_top = (W // 2, 14)
    seat_right = (W // 2 + 10, 19)
    seat_back = (W // 2, 24)
    seat_left = (W // 2 - 10, 19)
    
    seat_polygon = [seat_top, seat_right, seat_back, seat_left]
    fill_polygon(img, seat_polygon, CUSHION_TONES[1])  # Base tone
    
    # Add cushion shading (top is lighter, bottom darker)
    for x, y in [(seat_top[0], seat_top[1] + 1), 
                 (seat_top[0] - 1, seat_top[1] + 1),
                 (seat_top[0] + 1, seat_top[1] + 1)]:
        if 0 <= x < W and 0 <= y < H:
            pixels[x, y] = CUSHION_TONES[0]  # Highlight
    
    # Darker bottom edge
    for x, y in [(seat_back[0] - 1, seat_back[1] - 1),
                 (seat_back[0], seat_back[1] - 1),
                 (seat_back[0] + 1, seat_back[1] - 1)]:
        if 0 <= x < W and 0 <= y < H:
            pixels[x, y] = CUSHION_TONES[3]  # Deep shadow
    
    # Front legs (simple vertical lines)
    leg_height = 12
    draw.line([(W // 2 - 8, 24), (W // 2 - 8, 24 + leg_height)], 
              fill=WOOD_FRAME[1], width=2)
    draw.line([(W // 2 + 8, 24), (W // 2 + 8, 24 + leg_height)], 
              fill=WOOD_FRAME[1], width=2)
    
    # Back rest (small cushioned back)
    back_top = (W // 2 - 2, 6)
    back_bottom = (W // 2 - 2, 14)
    draw.line([back_top, back_bottom], fill=CUSHION_TONES[2], width=6)
    
    # Back rest highlight
    pixels[W // 2 - 2, 7] = CUSHION_TONES[0]
    pixels[W // 2 - 1, 7] = CUSHION_TONES[0]
    
    # Cast shadow (simple oval underneath)
    shadow_polygon = [
        (W // 2 - 12, H - 2),
        (W // 2 + 12, H - 2),
        (W // 2 + 10, H - 1),
        (W // 2 - 10, H - 1),
    ]
    add_cast_shadow(img, shadow_polygon, (0, 0, 0, 100))
    
    # Black outlines
    draw.polygon(seat_polygon, outline=(0, 0, 0, 255))
    
    return img


def create_table():
    """Create an isometric table with reflective surface"""
    W, H = 40, 36
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pixels = img.load()
    
    # Table top (light wood)
    TABLE_TONES = generate_tone_ramp((200, 160, 120, 255), num_tones=4)
    
    # Top surface (isometric diamond)
    top_center = (W // 2, 8)
    top_right = (W // 2 + 14, 15)
    top_back = (W // 2, 22)
    top_left = (W // 2 - 14, 15)
    
    top_surface = [top_center, top_right, top_back, top_left]
    fill_polygon(img, top_surface, TABLE_TONES[0])  # Lightest (receives light)
    
    # Add wood grain texture to top
    random.seed(200)
    for _ in range(5):
        # Horizontal grain lines
        y = random.randint(10, 20)
        for x in range(top_left[0] + 2, top_right[0] - 2):
            if 0 <= x < W and 0 <= y < H and pixels[x, y][3] > 0:
                if random.random() > 0.6:
                    pixels[x, y] = TABLE_TONES[1]
    
    # Specular highlight (shiny table)
    highlight_points = [
        (W // 2 + 4, 12),
        (W // 2 + 5, 13),
        (W // 2 + 3, 13),
    ]
    add_specular_highlight(img, highlight_points, (255, 255, 255, 200))
    
    # Table legs (4 visible, isometric perspective)
    leg_length = 10
    
    # Front legs
    draw.line([(W // 2 - 12, 16), (W // 2 - 12, 16 + leg_length)], 
              fill=TABLE_TONES[2], width=2)
    draw.line([(W // 2 + 12, 16), (W // 2 + 12, 16 + leg_length)], 
              fill=TABLE_TONES[2], width=2)
    
    # Back legs (partially obscured, thinner)
    draw.line([(W // 2 - 2, 21), (W // 2 - 2, 21 + leg_length - 2)], 
              fill=TABLE_TONES[3], width=1)
    draw.line([(W // 2 + 2, 21), (W // 2 + 2, 21 + leg_length - 2)], 
              fill=TABLE_TONES[3], width=1)
    
    # Cast shadow
    shadow_polygon = [
        (W // 2 - 16, H - 2),
        (W // 2 + 16, H - 2),
        (W // 2 + 14, H),
        (W // 2 - 14, H),
    ]
    add_cast_shadow(img, shadow_polygon, (0, 0, 0, 90))
    
    # Outline
    draw.polygon(top_surface, outline=(0, 0, 0, 255))
    
    return img


def create_lamp():
    """Create an isometric lamp with GLOW effect"""
    W, H = 24, 48
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pixels = img.load()
    
    # Lamp colors
    BASE_TONES = generate_tone_ramp((150, 150, 150, 255), num_tones=3)  # Gray metal
    SHADE_COLOR = (255, 240, 200, 220)  # Warm light shade (semi-transparent)
    BULB_COLOR = (255, 255, 220, 255)  # Bright yellow-white
    
    # Base (small cylinder at bottom)
    base_top = (W // 2, H - 10)
    base_width = 6
    
    # Base top (ellipse)
    for x in range(W // 2 - base_width, W // 2 + base_width):
        for y in range(H - 12, H - 8):
            dx = abs(x - W // 2)
            dy = abs(y - (H - 10)) * 2  # Ellipse ratio
            if dx * dx + dy * dy < base_width * base_width:
                pixels[x, y] = BASE_TONES[0]
    
    # Base stem
    draw.line([(W // 2, H - 10), (W // 2, H - 2)], fill=BASE_TONES[1], width=3)
    
    # Lamp post (thin vertical)
    draw.line([(W // 2, 16), (W // 2, H - 10)], fill=BASE_TONES[2], width=2)
    
    # Lamp shade (cone/dome shape)
    shade_top = (W // 2, 6)
    shade_bottom_left = (W // 2 - 8, 16)
    shade_bottom_right = (W // 2 + 8, 16)
    
    # Shade shape (triangle)
    shade_polygon = [shade_top, shade_bottom_right, shade_bottom_left]
    fill_polygon(img, shade_polygon, SHADE_COLOR)
    
    # Shade shading (lighter on top, darker on sides)
    pixels[W // 2, 8] = (255, 250, 230, 255)
    pixels[W // 2 - 1, 8] = (255, 250, 230, 255)
    pixels[W // 2 + 1, 8] = (255, 250, 230, 255)
    
    # Light bulb (bright spot)
    bulb_pos = (W // 2, 14)
    pixels[bulb_pos[0], bulb_pos[1]] = BULB_COLOR
    pixels[bulb_pos[0] - 1, bulb_pos[1]] = BULB_COLOR
    pixels[bulb_pos[0] + 1, bulb_pos[1]] = BULB_COLOR
    
    # GLOW EFFECT (key feature!)
    add_glow_effect(img, bulb_pos, radius=16, glow_color=(255, 240, 180, 255))
    
    # Outlines
    draw.polygon(shade_polygon, outline=(0, 0, 0, 255))
    
    # Small shadow at base
    shadow_polygon = [(W // 2 - 8, H - 1), (W // 2 + 8, H - 1),
                     (W // 2 + 6, H), (W // 2 - 6, H)]
    add_cast_shadow(img, shadow_polygon, (0, 0, 0, 80))
    
    return img


def create_bed():
    """Create an isometric bed with pillow and soft shading"""
    W, H = 64, 48
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pixels = img.load()
    
    # Bed colors
    MATTRESS_TONES = generate_tone_ramp((100, 140, 180, 255), num_tones=4)  # Blue
    PILLOW_TONES = generate_tone_ramp((220, 220, 240, 255), num_tones=3)  # White
    FRAME_TONES = generate_tone_ramp((90, 60, 40, 255), num_tones=3)  # Dark wood
    
    # Mattress top surface (large isometric rectangle)
    mattress_top = (W // 2, 12)
    mattress_right = (W // 2 + 24, 24)
    mattress_back = (W // 2, 36)
    mattress_left = (W // 2 - 24, 24)
    
    mattress_surface = [mattress_top, mattress_right, mattress_back, mattress_left]
    fill_polygon(img, mattress_surface, MATTRESS_TONES[1])
    
    # Mattress shading (softer, rounded look)
    # Top edge is lighter
    for x in range(mattress_top[0] - 20, mattress_top[0] + 20):
        for y in range(mattress_top[1], mattress_top[1] + 4):
            if 0 <= x < W and 0 <= y < H and pixels[x, y][3] > 0:
                pixels[x, y] = MATTRESS_TONES[0]  # Highlight
    
    # Bottom edge is darker
    for x in range(mattress_back[0] - 20, mattress_back[0] + 20):
        for y in range(mattress_back[1] - 4, mattress_back[1]):
            if 0 <= x < W and 0 <= y < H and pixels[x, y][3] > 0:
                pixels[x, y] = MATTRESS_TONES[3]  # Deep shadow
    
    # Pillow (small rounded shape at head)
    pillow_center = (W // 2 - 6, 16)
    pillow_polygon = [
        (pillow_center[0], pillow_center[1] - 3),
        (pillow_center[0] + 8, pillow_center[1]),
        (pillow_center[0], pillow_center[1] + 3),
        (pillow_center[0] - 8, pillow_center[1]),
    ]
    fill_polygon(img, pillow_polygon, PILLOW_TONES[1])
    
    # Pillow highlight
    pixels[pillow_center[0], pillow_center[1] - 1] = PILLOW_TONES[0]
    pixels[pillow_center[0] - 1, pillow_center[1] - 1] = PILLOW_TONES[0]
    
    # Bed frame (thin dark outline underneath mattress)
    frame_bottom = (W // 2, 40)
    frame_right = (W // 2 + 26, 28)
    frame_left = (W // 2 - 26, 28)
    
    # Draw frame edges
    draw.line([mattress_right, frame_right], fill=FRAME_TONES[2], width=2)
    draw.line([mattress_left, frame_left], fill=FRAME_TONES[2], width=2)
    draw.line([frame_right, frame_bottom], fill=FRAME_TONES[1], width=2)
    draw.line([frame_left, frame_bottom], fill=FRAME_TONES[1], width=2)
    
    # Shadow
    shadow_polygon = [
        (W // 2 - 28, H - 2),
        (W // 2 + 28, H - 2),
        (W // 2 + 24, H),
        (W // 2 - 24, H),
    ]
    add_cast_shadow(img, shadow_polygon, (0, 0, 0, 100))
    
    # Outlines
    draw.polygon(mattress_surface, outline=(0, 0, 0, 255))
    draw.polygon(pillow_polygon, outline=(0, 0, 0, 255))
    
    return img


def create_bookshelf():
    """Create an isometric bookshelf with colorful books"""
    W, H = 48, 64
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pixels = img.load()
    
    # Shelf frame (dark wood)
    SHELF_TONES = generate_tone_ramp((80, 50, 30, 255), num_tones=3)
    
    # Outer frame (tall rectangle in isometric)
    frame_top_front = (W // 2, 4)
    frame_top_right = (W // 2 + 16, 12)
    frame_bottom_front = (W // 2, H - 8)
    frame_bottom_right = (W // 2 + 16, H)
    
    # Right face of bookshelf
    right_face = [frame_top_front, frame_top_right, frame_bottom_right, frame_bottom_front]
    fill_polygon(img, right_face, SHELF_TONES[1])
    
    # Shelves (horizontal dividers - 3 shelves)
    shelf_heights = [20, 36, 52]
    
    for shelf_y in shelf_heights:
        # Shelf surface (small isometric rectangle)
        shelf_front = (W // 2 + 2, shelf_y)
        shelf_right = (W // 2 + 14, shelf_y + 4)
        shelf_back = (W // 2 + 2, shelf_y + 8)
        shelf_left = (W // 2 - 10, shelf_y + 4)
        
        shelf_polygon = [shelf_front, shelf_right, shelf_back, shelf_left]
        fill_polygon(img, shelf_polygon, SHELF_TONES[0])
        draw.polygon(shelf_polygon, outline=(0, 0, 0, 255))
    
    # Books on shelves (colorful spines)
    book_colors = [
        (200, 50, 50, 255),   # Red
        (50, 100, 200, 255),  # Blue
        (100, 180, 80, 255),  # Green
        (200, 150, 50, 255),  # Yellow
        (150, 70, 150, 255),  # Purple
    ]
    
    random.seed(300)
    
    for shelf_y in shelf_heights:
        # Draw books on this shelf
        book_x = W // 2 - 8
        num_books = random.randint(4, 6)
        
        for _ in range(num_books):
            book_width = random.randint(3, 6)
            book_height = random.randint(8, 12)
            book_color = random.choice(book_colors)
            
            # Simple book rectangle
            draw.rectangle(
                [(book_x, shelf_y - book_height), 
                 (book_x + book_width, shelf_y)],
                fill=book_color,
                outline=(0, 0, 0, 255)
            )
            
            book_x += book_width + 1
            if book_x > W // 2 + 10:
                break
    
    # Outer outline
    draw.polygon(right_face, outline=(0, 0, 0, 255))
    
    # Shadow
    shadow_polygon = [(W // 2 - 2, H - 1), (W // 2 + 18, H - 1),
                     (W // 2 + 16, H), (W // 2 - 4, H)]
    add_cast_shadow(img, shadow_polygon, (0, 0, 0, 90))
    
    return img


def main():
    output_dir = "../client/public/assets"
    os.makedirs(output_dir, exist_ok=True)
    
    print("🪑 Generating professional isometric furniture...\n")
    
    # Chair
    print("🪑 Creating chair...")
    chair_img = create_chair()
    chair_path = f"{output_dir}/furn_chair.png"
    chair_img.save(chair_path, 'PNG')
    print(f"   ✓ furn_chair.png ({os.path.getsize(chair_path)} bytes)")
    
    # Table
    print("📦 Creating table...")
    table_img = create_table()
    table_path = f"{output_dir}/furn_table.png"
    table_img.save(table_path, 'PNG')
    print(f"   ✓ furn_table.png ({os.path.getsize(table_path)} bytes)")
    
    # Lamp
    print("💡 Creating lamp with glow...")
    lamp_img = create_lamp()
    lamp_path = f"{output_dir}/furn_lamp.png"
    lamp_img.save(lamp_path, 'PNG')
    print(f"   ✓ furn_lamp.png ({os.path.getsize(lamp_path)} bytes)")
    
    # Bed
    print("🛏️  Creating bed...")
    bed_img = create_bed()
    bed_path = f"{output_dir}/furn_bed.png"
    bed_img.save(bed_path, 'PNG')
    print(f"   ✓ furn_bed.png ({os.path.getsize(bed_path)} bytes)")
    
    # Bookshelf
    print("📚 Creating bookshelf...")
    bookshelf_img = create_bookshelf()
    bookshelf_path = f"{output_dir}/furn_bookshelf.png"
    bookshelf_img.save(bookshelf_path, 'PNG')
    print(f"   ✓ furn_bookshelf.png ({os.path.getsize(bookshelf_path)} bytes)")
    
    print("\n✅ Furniture complete! All pieces have rich detail and effects.\n")


if __name__ == "__main__":
    main()
