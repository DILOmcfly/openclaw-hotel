import { describe, it, expect, vi } from 'vitest';
import {
  setPlaylist,
  play,
  pause,
  nextTrack,
  prevTrack,
  setVolume,
  setRepeatMode,
  getPlaylist,
  addTrack,
  removeTrack,
  type Track,
} from '../services/jukebox.js';

describe('Jukebox Service', () => {
  const roomId = '11111111-1111-1111-1111-111111111111';
  const sampleTracks: Track[] = [
    { title: 'Track 1', artist: 'Artist A', genre: 'Pop', durationSecs: 180 },
    { title: 'Track 2', artist: 'Artist B', genre: 'Rock', durationSecs: 240 },
  ];

  describe('setPlaylist', () => {
    it('should create a new playlist', async () => {
      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([]) // SELECT existing
        .mockResolvedValueOnce([{ // INSERT new
          id: 'playlist-123',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0,
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await setPlaylist(roomId, sampleTracks, mockSql);

      expect(playlist.roomId).toBe(roomId);
      expect(playlist.tracks).toHaveLength(2);
      expect(playlist.isPlaying).toBe(false);
      expect(mockSql).toHaveBeenCalledTimes(2);
    });

    it('should update existing playlist', async () => {
      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{ id: 'existing-id' }]) // SELECT existing
        .mockResolvedValueOnce([{ // UPDATE
          id: 'existing-id',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0,
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await setPlaylist(roomId, sampleTracks, mockSql);

      expect(playlist.id).toBe('existing-id');
      expect(mockSql).toHaveBeenCalledTimes(2);
    });

    it('should reject playlists exceeding 20 tracks', async () => {
      const mockSql: any = vi.fn();
      const tooManyTracks: Track[] = Array(21).fill({
        title: 'Test',
        artist: 'Test',
        genre: 'Test',
        durationSecs: 120,
      });

      await expect(setPlaylist(roomId, tooManyTracks, mockSql)).rejects.toThrow('cannot exceed 20 tracks');
    });
  });

  describe('play/pause', () => {
    it('should start playing', async () => {
      const mockSql: any = vi.fn().mockResolvedValueOnce([{
        id: 'playlist-123',
        room_id: roomId,
        tracks: sampleTracks,
        current_track: 0,
        is_playing: true,
        volume: 70,
        repeat_mode: 'none',
        updated_at: new Date(),
      }]);

      const playlist = await play(roomId, mockSql);

      expect(playlist.isPlaying).toBe(true);
      expect(mockSql).toHaveBeenCalled();
    });

    it('should pause playback', async () => {
      const mockSql: any = vi.fn().mockResolvedValueOnce([{
        id: 'playlist-123',
        room_id: roomId,
        tracks: sampleTracks,
        current_track: 0,
        is_playing: false,
        volume: 70,
        repeat_mode: 'none',
        updated_at: new Date(),
      }]);

      const playlist = await pause(roomId, mockSql);

      expect(playlist.isPlaying).toBe(false);
    });

    it('should throw if playlist not found', async () => {
      const mockSql: any = vi.fn().mockResolvedValueOnce([]);

      await expect(play(roomId, mockSql)).rejects.toThrow('not found');
    });
  });

  describe('nextTrack/prevTrack', () => {
    it('should advance to next track (none repeat)', async () => {
      const mockGetPlaylist = {
        tracks: sampleTracks,
        currentTrack: 0,
        repeatMode: 'none' as const,
        roomId,
        id: 'pl-1',
        isPlaying: true,
        volume: 70,
        updatedAt: new Date(),
      };

      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{ // getPlaylist
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0,
          is_playing: true,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }])
        .mockResolvedValueOnce([{ // UPDATE
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 1,
          is_playing: true,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await nextTrack(roomId, mockSql);

      expect(playlist.currentTrack).toBe(1);
    });

    it('should loop to first track (all repeat)', async () => {
      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 1, // last track
          is_playing: true,
          volume: 70,
          repeat_mode: 'all',
          updated_at: new Date(),
        }])
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0, // back to first
          is_playing: true,
          volume: 70,
          repeat_mode: 'all',
          updated_at: new Date(),
        }]);

      const playlist = await nextTrack(roomId, mockSql);

      expect(playlist.currentTrack).toBe(0);
    });

    it('should repeat same track (one repeat)', async () => {
      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0,
          is_playing: true,
          volume: 70,
          repeat_mode: 'one',
          updated_at: new Date(),
        }])
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0, // stays the same
          is_playing: true,
          volume: 70,
          repeat_mode: 'one',
          updated_at: new Date(),
        }]);

      const playlist = await nextTrack(roomId, mockSql);

      expect(playlist.currentTrack).toBe(0);
    });

    it('should go to previous track', async () => {
      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 1,
          is_playing: true,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }])
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0,
          is_playing: true,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await prevTrack(roomId, mockSql);

      expect(playlist.currentTrack).toBe(0);
    });

    it('should clamp to 0 when going prev from first track', async () => {
      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0,
          is_playing: true,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }])
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0, // clamped
          is_playing: true,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await prevTrack(roomId, mockSql);

      expect(playlist.currentTrack).toBe(0);
    });
  });

  describe('setVolume', () => {
    it('should update volume', async () => {
      const mockSql: any = vi.fn().mockResolvedValueOnce([{
        id: 'pl-1',
        room_id: roomId,
        tracks: sampleTracks,
        current_track: 0,
        is_playing: true,
        volume: 50,
        repeat_mode: 'none',
        updated_at: new Date(),
      }]);

      const playlist = await setVolume(roomId, 50, mockSql);

      expect(playlist.volume).toBe(50);
    });

    it('should reject volume < 0', async () => {
      const mockSql: any = vi.fn();

      await expect(setVolume(roomId, -10, mockSql)).rejects.toThrow('must be between 0 and 100');
    });

    it('should reject volume > 100', async () => {
      const mockSql: any = vi.fn();

      await expect(setVolume(roomId, 150, mockSql)).rejects.toThrow('must be between 0 and 100');
    });
  });

  describe('setRepeatMode', () => {
    it('should change repeat mode', async () => {
      const mockSql: any = vi.fn().mockResolvedValueOnce([{
        id: 'pl-1',
        room_id: roomId,
        tracks: sampleTracks,
        current_track: 0,
        is_playing: true,
        volume: 70,
        repeat_mode: 'all',
        updated_at: new Date(),
      }]);

      const playlist = await setRepeatMode(roomId, 'all', mockSql);

      expect(playlist.repeatMode).toBe('all');
    });

    it('should reject invalid mode', async () => {
      const mockSql: any = vi.fn();

      await expect(setRepeatMode(roomId, 'invalid' as any, mockSql)).rejects.toThrow('Invalid repeat mode');
    });
  });

  describe('addTrack', () => {
    it('should add a track to existing playlist', async () => {
      const newTrack: Track = { title: 'Track 3', artist: 'Artist C', genre: 'Jazz', durationSecs: 200 };

      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{ // getPlaylist
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0,
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }])
        .mockResolvedValueOnce([{ // UPDATE
          id: 'pl-1',
          room_id: roomId,
          tracks: [...sampleTracks, newTrack],
          current_track: 0,
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await addTrack(roomId, newTrack, mockSql);

      expect(playlist.tracks).toHaveLength(3);
    });

    it('should create playlist if none exists', async () => {
      const newTrack: Track = { title: 'Track 1', artist: 'Artist A', genre: 'Pop', durationSecs: 180 };

      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([]) // getPlaylist returns null
        .mockResolvedValueOnce([]) // setPlaylist SELECT existing
        .mockResolvedValueOnce([{ // setPlaylist INSERT
          id: 'pl-new',
          room_id: roomId,
          tracks: [newTrack],
          current_track: 0,
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await addTrack(roomId, newTrack, mockSql);

      expect(playlist.tracks).toHaveLength(1);
    });

    it('should reject adding beyond 20 tracks', async () => {
      const fullPlaylist = Array(20).fill({
        title: 'Test',
        artist: 'Test',
        genre: 'Test',
        durationSecs: 120,
      });

      const mockSql: any = vi.fn().mockResolvedValueOnce([{
        id: 'pl-1',
        room_id: roomId,
        tracks: fullPlaylist,
        current_track: 0,
        is_playing: false,
        volume: 70,
        repeat_mode: 'none',
        updated_at: new Date(),
      }]);

      const newTrack: Track = { title: 'Extra', artist: 'Extra', genre: 'Extra', durationSecs: 100 };

      await expect(addTrack(roomId, newTrack, mockSql)).rejects.toThrow('cannot exceed 20 tracks');
    });
  });

  describe('removeTrack', () => {
    it('should remove a track', async () => {
      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 0,
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }])
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: [sampleTracks[1]], // removed first track
          current_track: 0,
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await removeTrack(roomId, 0, mockSql);

      expect(playlist.tracks).toHaveLength(1);
    });

    it('should adjust current track index if removed before current', async () => {
      const mockSql: any = vi.fn()
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: sampleTracks,
          current_track: 1,
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }])
        .mockResolvedValueOnce([{
          id: 'pl-1',
          room_id: roomId,
          tracks: [sampleTracks[1]],
          current_track: 0, // adjusted down
          is_playing: false,
          volume: 70,
          repeat_mode: 'none',
          updated_at: new Date(),
        }]);

      const playlist = await removeTrack(roomId, 0, mockSql);

      expect(playlist.currentTrack).toBe(0);
    });

    it('should reject invalid index', async () => {
      const mockSql: any = vi.fn().mockResolvedValueOnce([{
        id: 'pl-1',
        room_id: roomId,
        tracks: sampleTracks,
        current_track: 0,
        is_playing: false,
        volume: 70,
        repeat_mode: 'none',
        updated_at: new Date(),
      }]);

      await expect(removeTrack(roomId, 99, mockSql)).rejects.toThrow('Invalid track index');
    });

    it('should throw if playlist not found', async () => {
      const mockSql: any = vi.fn().mockResolvedValueOnce([]);

      await expect(removeTrack(roomId, 0, mockSql)).rejects.toThrow('not found');
    });
  });
});
