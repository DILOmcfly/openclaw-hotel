"""
Professional Isometric Pixel Art Helper Library
Uses PIL/Pillow for pixel-perfect control
Follows 2:1 isometric ratio and Habbo Hotel style principles
"""

from PIL import Image, ImageDraw
import colorsys
import random
import math


# ============================================================================
# COLOR UTILITIES
# ============================================================================

def rgb_to_hsv(rgb):
    """Convert RGB tuple (0-255) to HSV (0-360, 0-1, 0-1)"""
    r, g, b = [x / 255.0 for x in rgb[:3]]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return (h * 360, s, v)


def hsv_to_rgb(hsv):
    """Convert HSV (0-360, 0-1, 0-1) to RGB tuple (0-255)"""
    h, s, v = hsv[0] / 360.0, hsv[1], hsv[2]
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (int(r * 255), int(g * 255), int(b * 255), 255)


def generate_tone_ramp(base_color, num_tones=4, saturation_shift=0.85):
    """
    Generate multi-tone color ramp from highlight to deep shadow
    
    Args:
        base_color: (r, g, b, a) tuple - base color
        num_tones: number of tones to generate (4-5 recommended)
        saturation_shift: multiplier for shadow saturation (0.8-0.9 typical)
    
    Returns:
        List of (r,g,b,a) tuples from lightest to darkest
    """
    h, s, v = rgb_to_hsv(base_color)
    
    tones = []
    for i in range(num_tones):
        # Map i from 0 to num_tones-1 to brightness range 1.4 to 0.4
        factor = 1.4 - (i / (num_tones - 1)) * 1.0
        
        # Adjust value
        new_v = min(1.0, v * factor)
        
        # Slightly desaturate darker tones (more realistic)
        if factor < 1.0:
            new_s = s * (saturation_shift + (1 - saturation_shift) * factor)
        else:
            new_s = s
        
        color_rgb = hsv_to_rgb((h, new_s, new_v))
        tones.append(color_rgb)
    
    return tones


# ============================================================================
# ISOMETRIC DRAWING PRIMITIVES
# ============================================================================

def draw_iso_line_2_1(img, start, length, direction, color, pixels=None):
    """
    Draw a 2:1 isometric line
    
    Args:
        img: PIL Image
        start: (x, y) starting point
        length: length in isometric units (will be scaled by 2:1 ratio)
        direction: 'ne', 'se', 'sw', 'nw' or 'right', 'left', 'up-right', 'up-left'
        color: (r,g,b,a) tuple
        pixels: Optional pre-loaded pixel array for faster access
    """
    if pixels is None:
        pixels = img.load()
    
    x, y = start
    
    # Direction vectors for 2:1 isometric
    directions = {
        'ne': (2, -1),    # Northeast (right-up)
        'right': (2, -1),
        'se': (2, 1),     # Southeast (right-down)
        'down-right': (2, 1),
        'sw': (-2, 1),    # Southwest (left-down)
        'left': (-2, 1),
        'nw': (-2, -1),   # Northwest (left-up)
        'up-left': (-2, -1),
    }
    
    dx, dy = directions.get(direction, (2, -1))
    
    # Draw the line pixel by pixel
    for i in range(length):
        px, py = x + i * dx, y + i * dy
        if 0 <= px < img.width and 0 <= py < img.height:
            pixels[px, py] = color


def draw_iso_box_outline(img, top_left, width, depth, height, outline_color=(0, 0, 0, 255)):
    """
    Draw isometric box outline (wireframe)
    
    Args:
        img: PIL Image
        top_left: (x, y) top corner position
        width: width in isometric units
        depth: depth in isometric units
        height: height in pixels (vertical)
        outline_color: color for outline
    
    Returns:
        dict with corner coordinates for filling faces
    """
    pixels = img.load()
    draw = ImageDraw.Draw(img)
    
    x, y = top_left
    
    # Calculate corners
    # Top face (diamond shape)
    top_front = (x, y)
    top_right = (x + width * 2, y + width)
    top_back = (x, y + width * 2)
    top_left_corner = (x - depth * 2, y + depth)
    
    # Bottom face corners (shifted down by height)
    bottom_front = (x, y + height)
    bottom_right = (x + width * 2, y + width + height)
    bottom_back = (x, y + width * 2 + height)
    bottom_left = (x - depth * 2, y + depth + height)
    
    # Draw top face (diamond)
    draw.line([top_front, top_right], fill=outline_color, width=1)
    draw.line([top_right, top_back], fill=outline_color, width=1)
    draw.line([top_back, top_left_corner], fill=outline_color, width=1)
    draw.line([top_left_corner, top_front], fill=outline_color, width=1)
    
    # Draw vertical edges
    if height > 0:
        draw.line([top_front, bottom_front], fill=outline_color, width=1)
        draw.line([top_right, bottom_right], fill=outline_color, width=1)
        draw.line([top_back, bottom_back], fill=outline_color, width=1)
        draw.line([top_left_corner, bottom_left], fill=outline_color, width=1)
    
    # Draw bottom edges (if visible)
    if height > 0:
        draw.line([bottom_front, bottom_right], fill=outline_color, width=1)
        draw.line([bottom_right, bottom_back], fill=outline_color, width=1)
    
    return {
        'top_face': [top_front, top_right, top_back, top_left_corner],
        'right_face': [top_front, top_right, bottom_right, bottom_front],
        'left_face': [top_front, top_left_corner, bottom_left, bottom_front],
    }


def fill_polygon(img, points, color):
    """Fill a polygon with solid color"""
    draw = ImageDraw.Draw(img)
    draw.polygon(points, fill=color)


# ============================================================================
# TEXTURE GENERATION
# ============================================================================

def wood_grain_texture(width, height, base_tones, seed=None):
    """
    Generate wood grain texture pattern
    
    Args:
        width, height: dimensions in pixels
        base_tones: list of colors from light to dark (4-5 tones)
        seed: random seed for reproducibility
    
    Returns:
        2D array of color indices into base_tones
    """
    if seed is not None:
        random.seed(seed)
    
    # Create base texture map
    texture = [[1 for _ in range(width)] for _ in range(height)]  # Start with base tone
    
    # Add horizontal grain streaks (wood planks run horizontally in iso tiles)
    num_streaks = height // 4
    for _ in range(num_streaks):
        y = random.randint(0, height - 1)
        streak_width = random.randint(1, 3)
        streak_length = random.randint(width // 2, width)
        start_x = random.randint(0, width - streak_length)
        
        tone = 0 if random.random() > 0.5 else 2  # Light or dark streak
        
        for dy in range(streak_width):
            for x in range(start_x, start_x + streak_length):
                if 0 <= y + dy < height and 0 <= x < width:
                    texture[y + dy][x] = tone
    
    # Add wood knots (small dark clusters)
    num_knots = random.randint(1, 3)
    for _ in range(num_knots):
        kx = random.randint(2, width - 3)
        ky = random.randint(2, height - 3)
        
        # Small cluster
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if 0 <= kx + dx < width and 0 <= ky + dy < height:
                    if random.random() > 0.3:
                        texture[ky + dy][kx + dx] = len(base_tones) - 1  # Darkest tone
    
    return texture


def carpet_pattern_texture(width, height, base_tones, pattern_type='diamond'):
    """
    Generate carpet pattern texture
    
    Args:
        width, height: dimensions
        base_tones: list of 3-4 colors
        pattern_type: 'diamond', 'dots', 'stripes'
    
    Returns:
        2D array of color indices
    """
    texture = [[1 for _ in range(width)] for _ in range(height)]  # Base color
    
    if pattern_type == 'diamond':
        # Diamond pattern every 8 pixels
        for y in range(0, height, 8):
            for x in range(0, width, 8):
                # Draw small diamond
                for size in range(4):
                    # Top half
                    if y - size >= 0:
                        for dx in range(-size, size + 1):
                            if 0 <= x + dx < width:
                                texture[y - size][x + dx] = 0 if size == 0 else 2
                    # Bottom half
                    if y + size < height:
                        for dx in range(-size, size + 1):
                            if 0 <= x + dx < width:
                                texture[y + size][x + dx] = 0 if size == 0 else 2
    
    elif pattern_type == 'dots':
        # Dot grid every 6 pixels
        for y in range(3, height, 6):
            for x in range(3, width, 6):
                if 0 <= x < width and 0 <= y < height:
                    texture[y][x] = 0
                    # Surround with darker tone
                    for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                        if 0 <= x + dx < width and 0 <= y + dy < height:
                            texture[y + dy][x + dx] = 2
    
    elif pattern_type == 'stripes':
        # Diagonal stripes following iso angle
        for y in range(height):
            for x in range(width):
                # 2:1 angle stripe pattern
                if (x * 1 + y * 2) % 8 < 3:
                    texture[y][x] = 2
    
    return texture


def marble_vein_texture(width, height, base_tones, seed=None):
    """
    Generate marble vein texture
    
    Args:
        width, height: dimensions
        base_tones: list of colors (light base + darker vein colors)
        seed: random seed
    
    Returns:
        2D array of color indices
    """
    if seed is not None:
        random.seed(seed)
    
    texture = [[0 for _ in range(width)] for _ in range(height)]  # Light base
    
    # Generate organic vein paths
    num_veins = random.randint(2, 4)
    
    for _ in range(num_veins):
        # Start position
        x = random.randint(0, width - 1)
        y = random.randint(0, height - 1)
        
        # Vein length
        length = random.randint(width // 2, width * 2)
        
        for step in range(length):
            if 0 <= x < width and 0 <= y < height:
                texture[y][x] = 2  # Vein color
                
                # Thicken vein slightly
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and random.random() > 0.5:
                        texture[ny][nx] = 1  # Mid-tone
            
            # Random walk (favor horizontal/diagonal)
            direction = random.choice([
                (2, 0), (2, 1), (2, -1),  # Right biased (2:1 iso)
                (-2, 0), (-2, 1), (-2, -1),  # Left biased
                (0, 1), (0, -1)  # Vertical
            ])
            x += direction[0]
            y += direction[1]
    
    return texture


def apply_texture_to_face(img, face_points, base_tones, texture_map):
    """
    Apply texture map to a face polygon
    
    Args:
        img: PIL Image
        face_points: list of (x,y) polygon points
        base_tones: list of colors corresponding to texture indices
        texture_map: 2D array of color indices
    """
    pixels = img.load()
    
    # Get bounding box of face
    xs = [p[0] for p in face_points]
    ys = [p[1] for p in face_points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    # Map texture to face bounds
    tex_height = len(texture_map)
    tex_width = len(texture_map[0]) if tex_height > 0 else 0
    
    if tex_width == 0 or tex_height == 0:
        return
    
    # Fill pixels inside polygon with texture
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            if point_in_polygon((x, y), face_points):
                # Map to texture coordinates
                tex_x = int(((x - min_x) / max(1, max_x - min_x)) * (tex_width - 1))
                tex_y = int(((y - min_y) / max(1, max_y - min_y)) * (tex_height - 1))
                
                tex_x = max(0, min(tex_width - 1, tex_x))
                tex_y = max(0, min(tex_height - 1, tex_y))
                
                color_idx = texture_map[tex_y][tex_x]
                if color_idx < len(base_tones):
                    if 0 <= x < img.width and 0 <= y < img.height:
                        pixels[x, y] = base_tones[color_idx]


def point_in_polygon(point, polygon):
    """Check if point is inside polygon using ray casting"""
    x, y = point
    n = len(polygon)
    inside = False
    
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    
    return inside


# ============================================================================
# SHADING & EFFECTS
# ============================================================================

def add_cast_shadow(img, shadow_polygon, shadow_color=(0, 0, 0, 80)):
    """
    Add a cast shadow (semi-transparent)
    
    Args:
        img: PIL Image
        shadow_polygon: list of (x, y) points
        shadow_color: RGBA tuple with alpha for transparency
    """
    # Create shadow layer
    shadow_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow_layer)
    draw.polygon(shadow_polygon, fill=shadow_color)
    
    # Composite onto main image
    img.paste(shadow_layer, (0, 0), shadow_layer)


def add_glow_effect(img, center, radius, glow_color=(255, 255, 200, 255)):
    """
    Add a glow effect (for lamps, etc.)
    
    Args:
        img: PIL Image
        center: (x, y) center of glow
        radius: glow radius in pixels
        glow_color: Base glow color
    """
    pixels = img.load()
    cx, cy = center
    
    for r in range(radius, 0, -1):
        # Alpha decreases with distance
        alpha = int(255 * (r / radius) * 0.3)  # Max 30% opacity
        
        r_g, g_g, b_g = glow_color[:3]
        current_glow = (r_g, g_g, b_g, alpha)
        
        # Draw circle at this radius
        for angle in range(0, 360, 15):  # Sample every 15 degrees
            rad = math.radians(angle)
            x = int(cx + r * math.cos(rad))
            y = int(cy + r * math.sin(rad))
            
            if 0 <= x < img.width and 0 <= y < img.height:
                # Blend with existing pixel
                existing = pixels[x, y]
                if existing[3] > 0:  # Don't overwrite transparent pixels
                    # Simple additive blend
                    new_r = min(255, existing[0] + current_glow[0] // 10)
                    new_g = min(255, existing[1] + current_glow[1] // 10)
                    new_b = min(255, existing[2] + current_glow[2] // 10)
                    pixels[x, y] = (new_r, new_g, new_b, existing[3])


def add_specular_highlight(img, points, highlight_color=(255, 255, 255, 200)):
    """
    Add specular highlights (small bright spots on shiny surfaces)
    
    Args:
        img: PIL Image
        points: list of (x, y) positions for highlights
        highlight_color: RGBA color for highlight
    """
    pixels = img.load()
    
    for x, y in points:
        if 0 <= x < img.width and 0 <= y < img.height:
            pixels[x, y] = highlight_color
            # Optional: add 1px dimmer surround
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < img.width and 0 <= ny < img.height:
                    dim_highlight = (highlight_color[0], highlight_color[1], 
                                   highlight_color[2], highlight_color[3] // 2)
                    existing = pixels[nx, ny]
                    if existing[3] > 0:
                        pixels[nx, ny] = dim_highlight


# ============================================================================
# OUTLINE HELPERS
# ============================================================================

def add_black_outline(img, outline_width=1):
    """
    Add black outline around all non-transparent pixels
    (Habbo style strong outlines)
    
    Args:
        img: PIL Image (RGBA)
        outline_width: width of outline (1-2 typical)
    """
    pixels = img.load()
    
    # Find all non-transparent edge pixels
    outline_pixels = set()
    
    for y in range(img.height):
        for x in range(img.width):
            if pixels[x, y][3] > 0:  # Non-transparent
                # Check neighbors
                for dx in range(-outline_width, outline_width + 1):
                    for dy in range(-outline_width, outline_width + 1):
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < img.width and 0 <= ny < img.height:
                            if pixels[nx, ny][3] == 0:  # Neighbor is transparent
                                outline_pixels.add((x, y))
                                break
    
    # Draw outline pixels as black
    for x, y in outline_pixels:
        pixels[x, y] = (0, 0, 0, 255)


# ============================================================================
# FLOOR TILE HELPER
# ============================================================================

def create_floor_tile(width, height, tones, texture_type, texture_seed=None):
    """
    Create an isometric floor tile with texture
    
    Args:
        width, height: tile dimensions (64x32 typical)
        tones: list of colors for this tile material
        texture_type: 'wood', 'carpet_diamond', 'carpet_dots', 'marble', 'grass'
        texture_seed: random seed for reproducibility
    
    Returns:
        PIL Image (RGBA)
    """
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    # Define diamond shape for iso floor tile
    top = (width // 2, 0)
    right = (width - 1, height // 2)
    bottom = (width // 2, height - 1)
    left = (0, height // 2)
    
    diamond = [top, right, bottom, left]
    
    # Generate texture
    if texture_type == 'wood':
        texture = wood_grain_texture(width, height, tones, texture_seed)
    elif texture_type.startswith('carpet'):
        pattern = texture_type.split('_')[1] if '_' in texture_type else 'diamond'
        texture = carpet_pattern_texture(width, height, tones, pattern)
    elif texture_type == 'marble':
        texture = marble_vein_texture(width, height, tones, texture_seed)
    elif texture_type == 'grass':
        # Grass is similar to wood but more random
        texture = wood_grain_texture(width, height, tones, texture_seed)
    else:
        # Fallback: solid base color
        texture = [[1 for _ in range(width)] for _ in range(height)]
    
    # Apply texture to diamond face
    apply_texture_to_face(img, diamond, tones, texture)
    
    # Add black outline
    draw = ImageDraw.Draw(img)
    draw.polygon(diamond, outline=(0, 0, 0, 255))
    
    return img


# ============================================================================
# PALETTE PRESETS
# ============================================================================

# Warm wood palette
WOOD_TONES = [
    (210, 180, 140, 255),  # Tan (highlight)
    (139, 111, 71, 255),   # Light brown (base)
    (101, 67, 33, 255),    # Medium brown (shadow)
    (69, 42, 19, 255),     # Dark brown (deep shadow)
]

# Rich carpet palette (red)
CARPET_RED_TONES = [
    (220, 100, 100, 255),  # Light red
    (180, 50, 50, 255),    # Red (base)
    (120, 30, 30, 255),    # Dark red (shadow)
]

# Marble palette (white)
MARBLE_TONES = [
    (255, 255, 255, 255),  # White (base)
    (230, 230, 230, 255),  # Light gray
    (180, 180, 190, 255),  # Gray (veins)
    (140, 140, 150, 255),  # Dark gray
]

# Grass palette
GRASS_TONES = [
    (150, 200, 100, 255),  # Light green (highlight)
    (90, 160, 70, 255),    # Green (base)
    (60, 120, 50, 255),    # Dark green (shadow)
    (40, 80, 30, 255),     # Deep green
]
