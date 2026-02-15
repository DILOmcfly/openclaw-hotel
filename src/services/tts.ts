import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

// Cache directory for TTS audio files
const TTS_CACHE_DIR = '/tmp/openclaw-tts-cache';
const MAX_CACHE_SIZE = 100; // Maximum number of cached files (LRU)
const MAX_TEXT_LENGTH = 200; // Maximum characters to synthesize

/**
 * Voice mapping based on agent personality archetype
 */
const VOICE_MAP: Record<string, string> = {
  // Leader archetypes (high competitiveness, high sociability)
  'Charismatic Leader': 'Alex', // Deep, authoritative
  'Strategic Commander': 'Alex',
  'Benevolent Guide': 'Samantha', // Warm, friendly
  'Social Catalyst': 'Samantha',
  
  // Maverick archetypes (high curiosity, high volatility)
  'Wild Card': 'Fred', // Energetic, dynamic
  'Creative Rebel': 'Veena', // Expressive
  'Daring Explorer': 'Fred',
  'Impulsive Innovator': 'Veena',
  
  // Scholar archetypes (high curiosity, low volatility)
  'Thoughtful Analyst': 'Daniel', // Calm, measured (British)
  'Quiet Observer': 'Karen', // Neutral
  'Methodical Builder': 'Daniel',
  'Contemplative Sage': 'Karen',
  
  // Default archetypes
  'Lone Wolf': 'Alex',
  'Generous Helper': 'Samantha',
  'Balanced Diplomat': 'Karen',
  'Cautious Participant': 'Daniel',
};

/**
 * Sanitize text for TTS (remove emojis, trim, limit length)
 */
export function sanitizeText(text: string): string {
  // Remove emojis and special characters
  const cleaned = text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
    .trim();
  
  // Limit length
  if (cleaned.length > MAX_TEXT_LENGTH) {
    return cleaned.substring(0, MAX_TEXT_LENGTH) + '...';
  }
  
  return cleaned;
}

/**
 * Get voice ID for agent based on personality archetype
 */
export function getVoiceForArchetype(archetype: string | null): string {
  if (!archetype) {
    return 'Karen'; // Default neutral voice
  }
  
  return VOICE_MAP[archetype] || 'Karen';
}

/**
 * Generate cache key for TTS request
 */
function getCacheKey(text: string, voiceId: string): string {
  return createHash('sha256').update(`${text}:${voiceId}`).digest('hex');
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  if (!existsSync(TTS_CACHE_DIR)) {
    await import('fs/promises').then(fs => fs.mkdir(TTS_CACHE_DIR, { recursive: true }));
  }
}

/**
 * Manage cache size (LRU eviction)
 */
async function manageCacheSize(): Promise<void> {
  try {
    const files = await readdir(TTS_CACHE_DIR);
    
    if (files.length <= MAX_CACHE_SIZE) {
      return; // Cache size is within limit
    }
    
    // Get file stats with mtime (last access time)
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = join(TTS_CACHE_DIR, file);
        const stats = await stat(filePath);
        return { file, mtime: stats.mtime, path: filePath };
      })
    );
    
    // Sort by mtime (oldest first)
    fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
    
    // Remove oldest files until we're under the limit
    const toRemove = fileStats.slice(0, fileStats.length - MAX_CACHE_SIZE);
    
    await Promise.all(toRemove.map(({ path }) => unlink(path)));
  } catch (error) {
    // Silent fail on cache management errors
  }
}

/**
 * Synthesize speech using macOS `say` command
 */
async function synthesizeSpeechMacOS(text: string, voiceId: string, outputPath: string): Promise<void> {
  const escapedText = text.replace(/'/g, "'\\''"); // Escape single quotes for shell
  const command = `say -v "${voiceId}" -o "${outputPath}" --data-format=LEF32@22050 '${escapedText}'`;
  
  await execAsync(command);
}

/**
 * Synthesize speech and return audio file path
 */
export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  agentId: string
): Promise<{ audioPath: string; cacheKey: string }> {
  // Sanitize text
  const sanitized = sanitizeText(text);
  
  if (!sanitized || sanitized.length === 0) {
    throw new Error('Text is empty after sanitization');
  }
  
  // Generate cache key
  const cacheKey = getCacheKey(sanitized, voiceId);
  const filename = `${cacheKey}.aiff`;
  const audioPath = join(TTS_CACHE_DIR, filename);
  
  // Check cache
  if (existsSync(audioPath)) {
    return { audioPath, cacheKey };
  }
  
  // Ensure cache directory exists
  await ensureCacheDir();
  
  // Manage cache size (LRU eviction)
  await manageCacheSize();
  
  // Synthesize speech
  try {
    await synthesizeSpeechMacOS(sanitized, voiceId, audioPath);
  } catch (error) {
    throw new Error(`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return { audioPath, cacheKey };
}

/**
 * Clear TTS cache
 */
export async function clearTTSCache(): Promise<number> {
  try {
    const files = await readdir(TTS_CACHE_DIR);
    
    await Promise.all(
      files.map((file) => unlink(join(TTS_CACHE_DIR, file)))
    );
    
    return files.length;
  } catch (error) {
    return 0;
  }
}
