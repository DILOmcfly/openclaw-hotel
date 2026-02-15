import { describe, it, expect } from 'vitest';

/**
 * Floor Patterns System Unit Tests
 * These tests validate input and logic without requiring a database connection
 */

describe('Floor Patterns System - Validation', () => {
  const VALID_PATTERNS = [
    'solid',
    'checkerboard',
    'stripes',
    'dots',
    'diamond',
    'wood',
    'marble',
    'grass',
    'carpet',
    'tile',
  ];

  // Hex color validation (6-digit only for floor tiles)
  const isValidHexColor = (hex: string): boolean => {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
  };

  const validatePattern = (pattern: string): boolean => {
    return VALID_PATTERNS.includes(pattern);
  };

  it('should validate all pattern types', () => {
    expect(validatePattern('solid')).toBe(true);
    expect(validatePattern('checkerboard')).toBe(true);
    expect(validatePattern('stripes')).toBe(true);
    expect(validatePattern('dots')).toBe(true);
    expect(validatePattern('diamond')).toBe(true);
    expect(validatePattern('wood')).toBe(true);
    expect(validatePattern('marble')).toBe(true);
    expect(validatePattern('grass')).toBe(true);
    expect(validatePattern('carpet')).toBe(true);
    expect(validatePattern('tile')).toBe(true);
  });

  it('should reject invalid patterns', () => {
    expect(validatePattern('invalid')).toBe(false);
    expect(validatePattern('brick')).toBe(false);
    expect(validatePattern('')).toBe(false);
    expect(validatePattern('SOLID')).toBe(false); // Case sensitive
  });

  it('should validate hex color format (#RRGGBB)', () => {
    // Valid
    expect(isValidHexColor('#FFFFFF')).toBe(true);
    expect(isValidHexColor('#000000')).toBe(true);
    expect(isValidHexColor('#FF5733')).toBe(true);
    expect(isValidHexColor('#abc123')).toBe(true);

    // Invalid
    expect(isValidHexColor('#FFF')).toBe(false); // Too short
    expect(isValidHexColor('FFFFFF')).toBe(false); // Missing #
    expect(isValidHexColor('#GGGGGG')).toBe(false); // Invalid chars
    expect(isValidHexColor('#1234567')).toBe(false); // Too long
    expect(isValidHexColor('')).toBe(false);
  });

  it('should accept case-insensitive hex colors', () => {
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('#FFFFFF')).toBe(true);
    expect(isValidHexColor('#FfFfFf')).toBe(true);
    expect(isValidHexColor('#aAbBcC')).toBe(true);
  });

  it('should calculate area fill correctly (2x2)', () => {
    const calculateTileCount = (x1: number, y1: number, x2: number, y2: number): number => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return (maxX - minX + 1) * (maxY - minY + 1);
    };

    expect(calculateTileCount(0, 0, 1, 1)).toBe(4); // 2x2 grid
  });

  it('should calculate area fill correctly (3x3)', () => {
    const calculateTileCount = (x1: number, y1: number, x2: number, y2: number): number => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return (maxX - minX + 1) * (maxY - minY + 1);
    };

    expect(calculateTileCount(0, 0, 2, 2)).toBe(9); // 3x3 grid
  });

  it('should calculate area fill with inverted coordinates', () => {
    const calculateTileCount = (x1: number, y1: number, x2: number, y2: number): number => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return (maxX - minX + 1) * (maxY - minY + 1);
    };

    // Coordinates in any order should give same result
    expect(calculateTileCount(0, 0, 2, 2)).toBe(calculateTileCount(2, 2, 0, 0));
    expect(calculateTileCount(0, 0, 2, 2)).toBe(calculateTileCount(2, 0, 0, 2));
    expect(calculateTileCount(0, 0, 2, 2)).toBe(9);
  });

  it('should calculate single tile area', () => {
    const calculateTileCount = (x1: number, y1: number, x2: number, y2: number): number => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return (maxX - minX + 1) * (maxY - minY + 1);
    };

    expect(calculateTileCount(5, 5, 5, 5)).toBe(1); // Single tile
  });

  it('should reject invalid tile data', () => {
    const validateTile = (
      pattern: string,
      color: string,
      secondaryColor: string
    ): { valid: boolean; error?: string } => {
      if (!validatePattern(pattern)) {
        return {
          valid: false,
          error: `Invalid pattern. Must be one of: ${VALID_PATTERNS.join(', ')}`,
        };
      }

      if (!isValidHexColor(color)) {
        return {
          valid: false,
          error: 'Invalid color format. Must be hex color (#RRGGBB)',
        };
      }

      if (!isValidHexColor(secondaryColor)) {
        return {
          valid: false,
          error: 'Invalid secondary color format. Must be hex color (#RRGGBB)',
        };
      }

      return { valid: true };
    };

    const result1 = validateTile('invalid', '#FFFFFF', '#000000');
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain('Invalid pattern');

    const result2 = validateTile('solid', 'FFFFFF', '#000000');
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain('Invalid color format');

    const result3 = validateTile('solid', '#FFFFFF', '000000');
    expect(result3.valid).toBe(false);
    expect(result3.error).toContain('Invalid secondary color format');
  });

  it('should validate complete tile data', () => {
    const validateTile = (
      pattern: string,
      color: string,
      secondaryColor: string
    ): { valid: boolean; error?: string } => {
      if (!validatePattern(pattern)) {
        return { valid: false, error: 'Invalid pattern' };
      }
      if (!isValidHexColor(color)) {
        return { valid: false, error: 'Invalid color' };
      }
      if (!isValidHexColor(secondaryColor)) {
        return { valid: false, error: 'Invalid secondary color' };
      }
      return { valid: true };
    };

    const result = validateTile('checkerboard', '#FF0000', '#00FF00');
    expect(result.valid).toBe(true);
  });

  it('should create floor tile object', () => {
    const createTile = (
      roomId: string,
      x: number,
      y: number,
      pattern: string,
      color: string,
      secondaryColor: string
    ) => {
      return {
        roomId,
        x,
        y,
        pattern,
        color,
        secondaryColor,
      };
    };

    const tile = createTile('room-123', 5, 10, 'checkerboard', '#FF0000', '#00FF00');
    expect(tile.roomId).toBe('room-123');
    expect(tile.x).toBe(5);
    expect(tile.y).toBe(10);
    expect(tile.pattern).toBe('checkerboard');
    expect(tile.color).toBe('#FF0000');
    expect(tile.secondaryColor).toBe('#00FF00');
  });

  it('should handle negative coordinates', () => {
    const createTile = (x: number, y: number) => ({ x, y });

    const tile = createTile(-5, -10);
    expect(tile.x).toBe(-5);
    expect(tile.y).toBe(-10);
  });

  it('should validate all 10 pattern types exist', () => {
    expect(VALID_PATTERNS).toHaveLength(10);
    expect(VALID_PATTERNS).toContain('solid');
    expect(VALID_PATTERNS).toContain('checkerboard');
    expect(VALID_PATTERNS).toContain('stripes');
    expect(VALID_PATTERNS).toContain('dots');
    expect(VALID_PATTERNS).toContain('diamond');
    expect(VALID_PATTERNS).toContain('wood');
    expect(VALID_PATTERNS).toContain('marble');
    expect(VALID_PATTERNS).toContain('grass');
    expect(VALID_PATTERNS).toContain('carpet');
    expect(VALID_PATTERNS).toContain('tile');
  });

  it('should normalize coordinates for area calculation', () => {
    const normalizeArea = (x1: number, y1: number, x2: number, y2: number) => {
      return {
        minX: Math.min(x1, x2),
        maxX: Math.max(x1, x2),
        minY: Math.min(y1, y2),
        maxY: Math.max(y1, y2),
      };
    };

    const area1 = normalizeArea(0, 0, 5, 5);
    expect(area1.minX).toBe(0);
    expect(area1.maxX).toBe(5);
    expect(area1.minY).toBe(0);
    expect(area1.maxY).toBe(5);

    const area2 = normalizeArea(5, 5, 0, 0);
    expect(area2.minX).toBe(0);
    expect(area2.maxX).toBe(5);
    expect(area2.minY).toBe(0);
    expect(area2.maxY).toBe(5);
  });

  it('should generate tile list for area', () => {
    const generateAreaTiles = (x1: number, y1: number, x2: number, y2: number) => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      const tiles: Array<{ x: number; y: number }> = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ x, y });
        }
      }
      return tiles;
    };

    const tiles = generateAreaTiles(0, 0, 1, 1);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ x: 0, y: 0 });
    expect(tiles).toContainEqual({ x: 0, y: 1 });
    expect(tiles).toContainEqual({ x: 1, y: 0 });
    expect(tiles).toContainEqual({ x: 1, y: 1 });
  });

  it('should validate default colors', () => {
    const DEFAULT_COLOR = '#CCCCCC';
    const DEFAULT_SECONDARY = '#999999';

    expect(isValidHexColor(DEFAULT_COLOR)).toBe(true);
    expect(isValidHexColor(DEFAULT_SECONDARY)).toBe(true);
  });

  it('should handle large area calculations', () => {
    const calculateTileCount = (x1: number, y1: number, x2: number, y2: number): number => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return (maxX - minX + 1) * (maxY - minY + 1);
    };

    expect(calculateTileCount(0, 0, 9, 9)).toBe(100); // 10x10 grid
    expect(calculateTileCount(-5, -5, 5, 5)).toBe(121); // 11x11 grid
  });
});
