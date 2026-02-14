/**
 * SoundManager — Web Audio API implementation
 * 
 * Loads and plays .ogg sound effects using AudioContext.
 * Supports volume control, enable/disable, and audio buffer caching.
 */

export type SoundEvent =
  | 'chat_message'
  | 'door_open'
  | 'furniture_place'
  | 'furniture_move'
  | 'furniture_rotate'
  | 'footstep'
  | 'ui_click'
  | 'agent_join'
  | 'agent_leave';

interface SoundConfig {
  volume: number;
  loop: boolean;
  path: string;
}

class SoundManagerClass {
  private enabled: boolean = true;
  private masterVolume: number = 0.7;
  private soundConfigs: Map<SoundEvent, SoundConfig> = new Map();
  private audioContext: AudioContext | null = null;
  private audioBuffers: Map<SoundEvent, AudioBuffer> = new Map();
  private masterGainNode: GainNode | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initializeSoundConfigs();
  }

  /**
   * Define sound configurations
   */
  private initializeSoundConfigs(): void {
    this.soundConfigs.set('chat_message', {
      volume: 0.5,
      loop: false,
      path: '/audio/sfx/chat_message.ogg',
    });

    this.soundConfigs.set('door_open', {
      volume: 0.6,
      loop: false,
      path: '/audio/sfx/door_open.ogg',
    });

    this.soundConfigs.set('furniture_place', {
      volume: 0.7,
      loop: false,
      path: '/audio/sfx/furniture_place.ogg',
    });

    this.soundConfigs.set('furniture_move', {
      volume: 0.5,
      loop: false,
      path: '/audio/sfx/furniture_move.ogg',
    });

    this.soundConfigs.set('furniture_rotate', {
      volume: 0.4,
      loop: false,
      path: '/audio/sfx/furniture_rotate.ogg',
    });

    this.soundConfigs.set('footstep', {
      volume: 0.3,
      loop: false,
      path: '/audio/sfx/footstep.ogg',
    });

    this.soundConfigs.set('ui_click', {
      volume: 0.4,
      loop: false,
      path: '/audio/sfx/ui_click.ogg',
    });

    this.soundConfigs.set('agent_join', {
      volume: 0.6,
      loop: false,
      path: '/audio/sfx/agent_join.ogg',
    });

    this.soundConfigs.set('agent_leave', {
      volume: 0.5,
      loop: false,
      path: '/audio/sfx/agent_leave.ogg',
    });
  }

  /**
   * Initialize AudioContext and load all sounds
   * Call this after user interaction (browser autoplay policy)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create AudioContext (Safari uses webkitAudioContext)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create master gain node for volume control
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.value = this.masterVolume;
      this.masterGainNode.connect(this.audioContext.destination);

      // Load all sound files
      const loadPromises = Array.from(this.soundConfigs.entries()).map(
        async ([event, config]) => {
          try {
            const response = await fetch(config.path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
            this.audioBuffers.set(event, audioBuffer);
          } catch (error) {
            console.error(`[SoundManager] Failed to load ${event}:`, error);
          }
        }
      );

      await Promise.all(loadPromises);
      this.initialized = true;
      console.log(`[SoundManager] ✅ Initialized with ${this.audioBuffers.size}/${this.soundConfigs.size} sounds loaded`);
    } catch (error) {
      console.error('[SoundManager] Initialization failed:', error);
    }
  }

  /**
   * Play a sound effect
   * 
   * @param event - Sound event identifier
   * @param volumeMultiplier - Optional volume multiplier (0-1)
   */
  play(event: SoundEvent, volumeMultiplier: number = 1.0): void {
    if (!this.enabled || !this.initialized || !this.audioContext || !this.masterGainNode) {
      return;
    }

    const config = this.soundConfigs.get(event);
    const buffer = this.audioBuffers.get(event);

    if (!config) {
      console.warn(`[SoundManager] Unknown sound event: ${event}`);
      return;
    }

    if (!buffer) {
      console.warn(`[SoundManager] Audio buffer not loaded for: ${event}`);
      return;
    }

    try {
      // Create buffer source
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = config.loop;

      // Create gain node for this sound
      const gainNode = this.audioContext.createGain();
      const finalVolume = config.volume * volumeMultiplier;
      gainNode.gain.value = finalVolume;

      // Connect: source -> gain -> master gain -> destination
      source.connect(gainNode);
      gainNode.connect(this.masterGainNode);

      // Play
      source.start(0);
    } catch (error) {
      console.error(`[SoundManager] Playback error for ${event}:`, error);
    }
  }

  /**
   * Enable or disable all sounds
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[SoundManager] Sound ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set master volume (0-1)
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = this.masterVolume;
    }
    
    console.log(`[SoundManager] Master volume: ${this.masterVolume.toFixed(2)}`);
  }

  /**
   * Check if sounds are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current master volume
   */
  getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Check if audio system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export const SoundManager = new SoundManagerClass();
