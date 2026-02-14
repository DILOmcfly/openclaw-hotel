"""
Generate high-quality isometric character sprites - V2
Hand-crafted pixel maps for Habbo-quality output
Each pixel is intentionally placed, not computed from geometric shapes
"""

import sys, os
sys.path.append(os.path.dirname(__file__))
from PIL import Image

# Color palette - Habbo-inspired
C = {
    '.': (0, 0, 0, 0),          # Transparent
    'O': (0, 0, 0, 255),        # Outline (black)
    # Skin
    's': (255, 220, 180, 255),  # Skin highlight
    'S': (235, 195, 155, 255),  # Skin base
    'd': (210, 170, 135, 255),  # Skin shadow
    # Hair (brown)
    'h': (120, 80, 50, 255),    # Hair highlight
    'H': (80, 50, 30, 255),     # Hair base
    'D': (50, 30, 15, 255),     # Hair dark
    # Shirt (blue)
    'b': (140, 180, 240, 255),  # Shirt highlight
    'B': (100, 150, 220, 255),  # Shirt base
    'N': (70, 120, 190, 255),   # Shirt shadow
    'n': (50, 90, 160, 255),    # Shirt deep shadow
    # Pants (dark)
    'p': (80, 80, 100, 255),    # Pants highlight
    'P': (60, 60, 80, 255),     # Pants base
    'q': (45, 45, 65, 255),     # Pants shadow
    # Shoes
    'x': (60, 45, 35, 255),    # Shoe highlight
    'X': (40, 30, 20, 255),    # Shoe base
    # Eyes
    'e': (50, 50, 50, 255),    # Eye
    'w': (255, 255, 255, 255), # Eye white
    # Shadow on ground
    'G': (0, 0, 0, 60),       # Ground shadow
}

# Each character sprite is a 32x48 pixel map
# Drawn pixel by pixel for maximum quality

SOUTH = [  # Facing front-right (SE in isometric)
    "................................",  # 0
    "................................",  # 1
    "..........OOOOOOO...............",  # 2
    ".........OHHHHHHhO..............",  # 3
    "........OHHHHHHHhhO.............",  # 4
    "........ODDHHHHHhhO.............",  # 5
    ".......ODDsSSSSsshO.............",  # 6
    ".......OdsSSSSSSshO.............",  # 7
    ".......OdsSewSweShO.............",  # 8
    ".......OdsSSSdSSShO.............",  # 9
    ".......OddSSdSSSSO.............",  # 10
    "........OdSSSSSSSO.............",  # 11
    "........OddSSdSSO..............",  # 12
    ".........OOSSSOO...............",  # 13
    "..........OSSSO................",  # 14
    ".........OBBBBBO...............",  # 15
    "........ONBBBBBbO..............",  # 16
    "........ONBBBBBbO..............",  # 17
    ".......ONNBBBBBbbO.............",  # 18
    ".......ONNBBBBBbbO.............",  # 19
    ".......OnNBBBBBbBO.............",  # 20
    ".......OnNBBBBBbBO.............",  # 21
    ".......OnNBBBBBbbO.............",  # 22
    "........ONBBBBBbO..............",  # 23
    "........ONBBBBBbO..............",  # 24
    ".........ONBBBO................",  # 25
    ".........OPPPPPO...............",  # 26
    "........OqPPPPPpO..............",  # 27
    "........OqPPPPPpO..............",  # 28
    "........OqPPOPPpO..............",  # 29
    "........OqPPOPPpO..............",  # 30
    "........OqPPOPPpO..............",  # 31
    "........OqPPOPPpO..............",  # 32
    "........OqPPOPPpO..............",  # 33
    "........OqPPOPPpO..............",  # 34
    "........OqPPOPPpO..............",  # 35
    "........OqPPOPPpO..............",  # 36
    "........OqPPOPPpO..............",  # 37
    "........OqPPOPPpO..............",  # 38
    "........OqPPOPPpO..............",  # 39
    ".......OXXxOOXXxO..............",  # 40
    ".......OXXxOOXXxO..............",  # 41
    "........OOO..OOO...............",  # 42
    "................................",  # 43
    ".......GGGGGGGGGG..............",  # 44
    "......GGGGGGGGGGGG.............",  # 45
    ".......GGGGGGGGGG..............",  # 46
    "................................",  # 47
]

NORTH = [  # Facing back-left (NW in isometric)
    "................................",
    "................................",
    "..........OOOOOOO...............",
    ".........OhHHHHHDO..............",
    "........OhhHHHHHDDO.............",
    "........OhhHHHHHDDO.............",
    ".......OhhHHHHHHDDO.............",
    ".......OhHHHHHHHDDO.............",
    ".......OhHHHHHHHDDO.............",
    ".......OhHHHHHHHDDO.............",
    ".......OhhHHHHHDDO.............",
    "........OhHHHHHDO..............",
    "........OhhHHHDDO..............",
    ".........OOSSSOO...............",
    "..........OSSSO................",
    ".........ObBBBBNO..............",
    "........ObbBBBBNNO.............",
    "........ObbBBBBNNO.............",
    ".......ObbBBBBBNNnO............",
    ".......ObbBBBBBNNnO............",
    ".......ObBBBBBNNnO.............",
    ".......ObBBBBBNNnO.............",
    ".......ObbBBBBNNnO.............",
    "........ObBBBBNNO..............",
    "........ObBBBBNNO..............",
    ".........ONBBNO................",
    ".........OpPPPPqO..............",
    "........OpPPPPPqqO.............",
    "........OpPPPPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    "........OpPPOPPqqO.............",
    ".......OxXXOOxXXO..............",
    ".......OxXXOOxXXO..............",
    "........OOO..OOO...............",
    "................................",
    ".......GGGGGGGGGG..............",
    "......GGGGGGGGGGGG.............",
    ".......GGGGGGGGGG..............",
    "................................",
]

EAST = [  # Facing right (NE in isometric) - profile view
    "................................",
    "................................",
    "...........OOOOOOO..............",
    "..........OHHHHHHHO.............",
    ".........OHHHHHHHhO.............",
    ".........OHHHHHHhhO.............",
    ".........OHSSSSShO..............",
    ".........OSSSSSShO..............",
    ".........OSSeSSSsOO.............",
    ".........OSSSSSSssO.............",
    ".........OSSSdSSSO..............",
    "..........OSSSSO................",
    "..........OdSSSO................",
    "...........OSSO.................",
    "..........OSSSO.................",
    "..........OBBBO.................",
    ".........ONBBBbO................",
    ".........ONBBBbO................",
    "........ONNBBBbbO...............",
    "........ONNBBBbbO...............",
    "........OnNBBBbO................",
    "........OnNBBBbO................",
    "........ONNBBBbO................",
    ".........ONBBBbO................",
    ".........ONBBBbO................",
    "..........ONBO..................",
    "..........OPPPO.................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    ".........OqPPPpO................",
    "........OXXxXXxO................",
    "........OXXxXXxO................",
    ".........OOOOO..................",
    "................................",
    "........GGGGGGG.................",
    ".......GGGGGGGGG...............",
    "........GGGGGGG.................",
    "................................",
]

WEST = [  # Facing left (SW in isometric) - profile view mirrored
    "................................",
    "................................",
    "..........OOOOOOO...............",
    ".........OHHHHHHHO..............",
    "........OhHHHHHHHO.............",
    "........OhhHHHHHHO.............",
    "..........OhSSSSHO.............",
    "..........OhSSSSSSO............",
    ".........OOsSSSeSSSO............",
    ".........OssSSSSSSSO............",
    "..........OSSSSdSSSO............",
    "..........OSSSSO................",
    "..........OSSSSdO...............",
    "..........OSSO..................",
    "..........OSSSO.................",
    "..........OBBBO.................",
    ".........ObBBBNO................",
    ".........ObBBBNO................",
    "........ObbBBBNNO...............",
    "........ObbBBBNNO...............",
    ".........ObBBBNnO...............",
    ".........ObBBBNnO...............",
    "........ObbBBBNNO...............",
    ".........ObBBBNO................",
    ".........ObBBBNO................",
    "..........OBNO..................",
    "..........OPPPO.................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    ".........OpPPPqO................",
    "........OxXXxXXO................",
    "........OxXXxXXO................",
    ".........OOOOO..................",
    "................................",
    "........GGGGGGG.................",
    ".......GGGGGGGGG...............",
    "........GGGGGGG.................",
    "................................",
]


def render_sprite(pixel_map, width=32, height=48):
    """Render a pixel map string array into a PIL Image"""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    pixels = img.load()
    
    for y, row in enumerate(pixel_map):
        for x, ch in enumerate(row[:width]):
            if ch in C:
                color = C[ch]
                if color[3] > 0:
                    pixels[x, y] = color
    
    return img


def main():
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'assets')
    os.makedirs(output_dir, exist_ok=True)
    
    print("🧍 Generating hand-crafted isometric character sprites v2...\n")
    
    sprites_data = {
        'south': (SOUTH, 'char_south.png'),
        'north': (NORTH, 'char_north.png'),
        'east': (EAST, 'char_east.png'),
        'west': (WEST, 'char_west.png'),
    }
    
    sprites = {}
    for direction, (pixel_map, filename) in sprites_data.items():
        print(f"👤 Rendering {direction}...")
        img = render_sprite(pixel_map)
        filepath = os.path.join(output_dir, filename)
        img.save(filepath, 'PNG')
        sprites[direction] = img
        file_size = os.path.getsize(filepath)
        print(f"   ✓ {filename} ({file_size} bytes)")
    
    # Create spritesheet
    print("\n📋 Creating character spritesheet...")
    sheet = Image.new('RGBA', (128, 48), (0, 0, 0, 0))
    for i, direction in enumerate(['south', 'north', 'east', 'west']):
        sheet.paste(sprites[direction], (i * 32, 0), sprites[direction])
    
    sheet_path = os.path.join(output_dir, 'character_spritesheet.png')
    sheet.save(sheet_path, 'PNG')
    print(f"   ✓ character_spritesheet.png ({os.path.getsize(sheet_path)} bytes)")
    
    print("\n✅ Character sprites v2 complete!")


if __name__ == "__main__":
    main()
