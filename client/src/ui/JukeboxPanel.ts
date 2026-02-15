/**
 * JukeboxPanel - Room music player and playlist manager
 * Owner can edit playlist, all agents can see playback state
 */

export type Track = {
  title: string;
  artist: string;
  genre: string;
  durationSecs: number;
};

export type PlaylistState = {
  id: string;
  roomId: string;
  tracks: Track[];
  currentTrack: number;
  isPlaying: boolean;
  volume: number;
  repeatMode: 'none' | 'one' | 'all';
  updatedAt: Date;
};

export class JukeboxPanel {
  private container: HTMLDivElement;
  private playlist: PlaylistState | null = null;
  private currentRoomId: string | null = null;
  private isRoomOwner: boolean = false;
  private agentId: string;
  private getToken: () => string;

  // Callbacks
  private onPlaylistUpdate?: (playlist: PlaylistState) => void;

  constructor(agentId: string, getToken: () => string) {
    this.agentId = agentId;
    this.getToken = getToken;
    this.container = document.createElement('div');
    this.container.className = 'jukebox-panel hidden';
    this.render();
  }

  public getElement(): HTMLDivElement {
    return this.container;
  }

  public show(): void {
    this.container.classList.remove('hidden');
  }

  public hide(): void {
    this.container.classList.add('hidden');
  }

  public async setRoom(roomId: string, isOwner: boolean): Promise<void> {
    this.currentRoomId = roomId;
    this.isRoomOwner = isOwner;
    await this.loadPlaylist();
  }

  public updatePlaylist(playlist: PlaylistState): void {
    this.playlist = playlist;
    this.render();
  }

  public setOnPlaylistUpdate(callback: (playlist: PlaylistState) => void): void {
    this.onPlaylistUpdate = callback;
  }

  private async loadPlaylist(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const response = await fetch(`/api/rooms/${this.currentRoomId}/jukebox`);
      if (response.status === 404) {
        this.playlist = null;
      } else if (response.ok) {
        this.playlist = await response.json();
      }
      this.render();
    } catch (error) {
      console.error('[Jukebox] Failed to load playlist:', error);
    }
  }

  private async play(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const response = await fetch(`/api/rooms/${this.currentRoomId}/jukebox/play`, {
        method: 'PUT',
      });
      if (response.ok) {
        const updated = await response.json();
        this.updatePlaylist(updated);
        this.onPlaylistUpdate?.(updated);
      }
    } catch (error) {
      console.error('[Jukebox] Failed to play:', error);
    }
  }

  private async pause(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const response = await fetch(`/api/rooms/${this.currentRoomId}/jukebox/pause`, {
        method: 'PUT',
      });
      if (response.ok) {
        const updated = await response.json();
        this.updatePlaylist(updated);
        this.onPlaylistUpdate?.(updated);
      }
    } catch (error) {
      console.error('[Jukebox] Failed to pause:', error);
    }
  }

  private async next(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const response = await fetch(`/api/rooms/${this.currentRoomId}/jukebox/next`, {
        method: 'PUT',
      });
      if (response.ok) {
        const updated = await response.json();
        this.updatePlaylist(updated);
        this.onPlaylistUpdate?.(updated);
      }
    } catch (error) {
      console.error('[Jukebox] Failed to skip:', error);
    }
  }

  private async setVolume(volume: number): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const response = await fetch(`/api/rooms/${this.currentRoomId}/jukebox/volume`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume }),
      });
      if (response.ok) {
        const updated = await response.json();
        this.updatePlaylist(updated);
        this.onPlaylistUpdate?.(updated);
      }
    } catch (error) {
      console.error('[Jukebox] Failed to set volume:', error);
    }
  }

  private async addTrack(track: Track): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const response = await fetch(`/api/rooms/${this.currentRoomId}/jukebox/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ track }),
      });

      if (response.ok) {
        const updated = await response.json();
        this.updatePlaylist(updated);
        this.onPlaylistUpdate?.(updated);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add track');
      }
    } catch (error) {
      console.error('[Jukebox] Failed to add track:', error);
      alert('Failed to add track');
    }
  }

  private async removeTrack(index: number): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const response = await fetch(`/api/rooms/${this.currentRoomId}/jukebox/track/${index}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (response.ok) {
        const updated = await response.json();
        this.updatePlaylist(updated);
        this.onPlaylistUpdate?.(updated);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to remove track');
      }
    } catch (error) {
      console.error('[Jukebox] Failed to remove track:', error);
      alert('Failed to remove track');
    }
  }

  private showAddTrackModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content jukebox-add-modal';
    modalContent.innerHTML = `
      <h3>Add Track</h3>
      <input type="text" id="track-title" placeholder="Title" maxlength="100">
      <input type="text" id="track-artist" placeholder="Artist" maxlength="100">
      <input type="text" id="track-genre" placeholder="Genre" maxlength="50">
      <input type="number" id="track-duration" placeholder="Duration (seconds)" min="1" max="3600">
      <div class="modal-buttons">
        <button class="btn-primary" id="add-track-btn">Add</button>
        <button class="btn-secondary" id="cancel-add-btn">Cancel</button>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const addBtn = modal.querySelector('#add-track-btn') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#cancel-add-btn') as HTMLButtonElement;

    addBtn.onclick = () => {
      const title = (modal.querySelector('#track-title') as HTMLInputElement).value.trim();
      const artist = (modal.querySelector('#track-artist') as HTMLInputElement).value.trim();
      const genre = (modal.querySelector('#track-genre') as HTMLInputElement).value.trim();
      const durationSecs = parseInt((modal.querySelector('#track-duration') as HTMLInputElement).value, 10);

      if (!title || !artist || !genre || isNaN(durationSecs) || durationSecs <= 0) {
        alert('Please fill all fields with valid values');
        return;
      }

      this.addTrack({ title, artist, genre, durationSecs });
      document.body.removeChild(modal);
    };

    cancelBtn.onclick = () => {
      document.body.removeChild(modal);
    };
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="panel-header">
        <h2>🎵 Jukebox</h2>
        <button class="btn-close">×</button>
      </div>
      <div class="panel-body">
        ${this.renderPlaybackControls()}
        ${this.renderPlaylist()}
        ${this.isRoomOwner ? this.renderOwnerControls() : ''}
      </div>
    `;

    // Attach event listeners
    const closeBtn = this.container.querySelector('.btn-close');
    closeBtn?.addEventListener('click', () => this.hide());

    const playBtn = this.container.querySelector('#jukebox-play');
    playBtn?.addEventListener('click', () => this.play());

    const pauseBtn = this.container.querySelector('#jukebox-pause');
    pauseBtn?.addEventListener('click', () => this.pause());

    const nextBtn = this.container.querySelector('#jukebox-next');
    nextBtn?.addEventListener('click', () => this.next());

    const volumeSlider = this.container.querySelector('#jukebox-volume') as HTMLInputElement;
    volumeSlider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.setVolume(parseInt(target.value, 10));
    });

    const addTrackBtn = this.container.querySelector('#add-track-btn');
    addTrackBtn?.addEventListener('click', () => this.showAddTrackModal());

    // Remove track buttons
    const removeButtons = this.container.querySelectorAll('.remove-track-btn');
    removeButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        if (confirm('Remove this track from the playlist?')) {
          this.removeTrack(index);
        }
      });
    });
  }

  private renderPlaybackControls(): string {
    if (!this.playlist) {
      return '<div class="jukebox-empty">No playlist set for this room</div>';
    }

    const currentTrack = this.playlist.tracks[this.playlist.currentTrack];
    const isPlaying = this.playlist.isPlaying;

    return `
      <div class="jukebox-controls">
        <div class="now-playing">
          <strong>Now Playing:</strong><br>
          ${currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : 'No tracks'}
        </div>
        <div class="playback-buttons">
          ${isPlaying 
            ? '<button id="jukebox-pause" class="btn-control">⏸</button>' 
            : '<button id="jukebox-play" class="btn-control">▶</button>'
          }
          <button id="jukebox-next" class="btn-control">⏭</button>
        </div>
        <div class="volume-control">
          <label>Volume: ${this.playlist.volume}%</label>
          <input type="range" id="jukebox-volume" min="0" max="100" value="${this.playlist.volume}">
        </div>
      </div>
    `;
  }

  private renderPlaylist(): string {
    if (!this.playlist || this.playlist.tracks.length === 0) {
      return '';
    }

    const tracks = this.playlist.tracks.map((track, index) => {
      const isCurrent = index === this.playlist!.currentTrack;
      return `
        <div class="track-item ${isCurrent ? 'current-track' : ''}">
          <div class="track-info">
            <div class="track-title">${track.title}</div>
            <div class="track-artist">${track.artist} • ${track.genre} • ${this.formatDuration(track.durationSecs)}</div>
          </div>
          ${this.isRoomOwner ? `<button class="remove-track-btn btn-danger">×</button>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="jukebox-playlist">
        <h3>Playlist (${this.playlist.tracks.length}/20)</h3>
        <div class="track-list">
          ${tracks}
        </div>
      </div>
    `;
  }

  private renderOwnerControls(): string {
    return `
      <div class="jukebox-owner-controls">
        <button id="add-track-btn" class="btn-primary">➕ Add Track</button>
      </div>
    `;
  }
}
