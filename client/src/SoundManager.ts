/**
 * SoundManager — Placeholder for future audio implementation
 * 
 * Currently logs sound events to console.
 * Ready to integrate Web Audio API for .ogg/.mp3 playback.
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
  path?: string; // Future: path to audio file
}

class SoundManagerClass {
  private enabled: boolean = true;
  private masterVolume: number = 0.7;
  private soundConfigs: Map<SoundEvent, SoundConfig> = new Map();

  constructor() {
    this.initializeSoundConfigs();
  }

  /**
   * Define sound configurations (placeholder paths)
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
   * Play a sound effect
   * 
   * @param event - Sound event identifier
   * @param volumeMultiplier - Optional volume multiplier (0-1)
   */
  play(event: SoundEvent, volumeMultiplier: number = 1.0): void {
    if (!this.enabled) return;

    const config = this.soundConfigs.get(event);
    if (!config) {
      console.warn(`[SoundManager] Unknown sound event: ${event}`);
      return;
    }

    const finalVolume = this.masterVolume * config.volume * volumeMultiplier;

    // TODO: Implement Web Audio API playback
    // const audio = new Audio(config.path);
    // audio.volume = finalVolume;
    // audio.loop = config.loop;
    // audio.play().catch(err => console.error('[SoundManager] Playback error:', err));

    // For now, just log to console
    console.log(
      `[SoundManager] 🔊 ${event} | Volume: ${finalVolume.toFixed(2)} | Path: ${config.path}`
    );
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
}

export const SoundManager = new SoundManagerClass();
