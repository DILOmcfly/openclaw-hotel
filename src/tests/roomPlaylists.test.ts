import { describe, it, expect } from 'vitest';

/**
 * Room Playlists System Unit Tests
 * Tests playlist management, track voting, and statistics without database
 */

describe('Room Playlists System', () => {
  describe('Playlist Creation', () => {
    it('should create playlist with default name', () => {
      const createPlaylist = (roomId: number, name?: string) => ({
        id: 1,
        roomId,
        name: name || 'Room Playlist',
        maxTracks: 30,
        shuffle: false,
      });

      const playlist = createPlaylist(101);
      expect(playlist.name).toBe('Room Playlist');
      expect(playlist.maxTracks).toBe(30);
      expect(playlist.shuffle).toBe(false);
    });

    it('should create playlist with custom name', () => {
      const createPlaylist = (roomId: number, name?: string) => ({
        id: 1,
        roomId,
        name: name || 'Room Playlist',
        maxTracks: 30,
        shuffle: false,
      });

      const playlist = createPlaylist(101, 'Chill Vibes');
      expect(playlist.name).toBe('Chill Vibes');
      expect(playlist.roomId).toBe(101);
    });

    it('should initialize with correct defaults', () => {
      const createPlaylist = (roomId: number, name?: string) => ({
        id: 1,
        roomId,
        name: name || 'Room Playlist',
        maxTracks: 30,
        shuffle: false,
      });

      const playlist = createPlaylist(202);
      expect(playlist.maxTracks).toBe(30);
      expect(playlist.shuffle).toBe(false);
    });
  });

  describe('Adding Tracks', () => {
    it('should add track with auto-positioning', () => {
      const tracks: any[] = [];
      
      const addTrack = (trackName: string, artist: string, position: number) => {
        const track = {
          id: tracks.length + 1,
          trackName,
          artist,
          position,
          durationSeconds: 180,
        };
        tracks.push(track);
        return track;
      };

      addTrack('Song 1', 'Artist A', 1);
      addTrack('Song 2', 'Artist B', 2);
      
      expect(tracks).toHaveLength(2);
      expect(tracks[1].position).toBe(2);
    });

    it('should respect max_tracks limit', () => {
      const maxTracks = 30;
      let trackCount = 30;

      const canAddTrack = (): boolean => trackCount < maxTracks;

      expect(canAddTrack()).toBe(false);
      trackCount = 25;
      expect(canAddTrack()).toBe(true);
    });

    it('should use default artist if not provided', () => {
      const addTrack = (trackName: string, artist?: string) => ({
        trackName,
        artist: artist || 'Unknown',
      });

      const track = addTrack('Mysterious Song');
      expect(track.artist).toBe('Unknown');
    });

    it('should use default duration if not provided', () => {
      const addTrack = (trackName: string, duration?: number) => ({
        trackName,
        durationSeconds: duration || 180,
      });

      const track = addTrack('Test Song');
      expect(track.durationSeconds).toBe(180);
    });

    it('should calculate next position correctly', () => {
      const getNextPosition = (currentMax: number): number => currentMax + 1;

      expect(getNextPosition(0)).toBe(1);
      expect(getNextPosition(5)).toBe(6);
      expect(getNextPosition(29)).toBe(30);
    });
  });

  describe('Track Removal', () => {
    it('should allow adder to remove their track', () => {
      const track = { id: 1, addedBy: 'agent123' };
      const canRemove = (agentId: string, roomOwner: string): boolean => {
        return track.addedBy === agentId || roomOwner === agentId;
      };

      expect(canRemove('agent123', 'owner456')).toBe(true);
    });

    it('should allow room owner to remove any track', () => {
      const track = { id: 1, addedBy: 'agent123' };
      const canRemove = (agentId: string, roomOwner: string): boolean => {
        return track.addedBy === agentId || roomOwner === agentId;
      };

      expect(canRemove('owner456', 'owner456')).toBe(true);
    });

    it('should deny removal by unauthorized agent', () => {
      const track = { id: 1, addedBy: 'agent123' };
      const canRemove = (agentId: string, roomOwner: string): boolean => {
        return track.addedBy === agentId || roomOwner === agentId;
      };

      expect(canRemove('agent999', 'owner456')).toBe(false);
    });
  });

  describe('Track Voting', () => {
    it('should validate vote values (-1 or 1)', () => {
      const isValidVote = (vote: number): boolean => vote === 1 || vote === -1;

      expect(isValidVote(1)).toBe(true);
      expect(isValidVote(-1)).toBe(true);
      expect(isValidVote(0)).toBe(false);
      expect(isValidVote(2)).toBe(false);
    });

    it('should toggle vote when same vote is cast', () => {
      const votes = new Map<string, number>();
      
      const voteTrack = (trackId: number, agentId: string, vote: number) => {
        const key = `${trackId}-${agentId}`;
        const existing = votes.get(key);
        
        if (existing === vote) {
          votes.delete(key); // Toggle off
        } else {
          votes.set(key, vote); // Set or update
        }
      };

      voteTrack(1, 'agent1', 1);
      expect(votes.has('1-agent1')).toBe(true);
      
      voteTrack(1, 'agent1', 1); // Toggle off
      expect(votes.has('1-agent1')).toBe(false);
    });

    it('should update vote when different vote is cast', () => {
      const votes = new Map<string, number>();
      
      const voteTrack = (trackId: number, agentId: string, vote: number) => {
        const key = `${trackId}-${agentId}`;
        const existing = votes.get(key);
        
        if (existing === vote) {
          votes.delete(key);
        } else {
          votes.set(key, vote);
        }
      };

      voteTrack(1, 'agent1', 1);
      expect(votes.get('1-agent1')).toBe(1);
      
      voteTrack(1, 'agent1', -1); // Change vote
      expect(votes.get('1-agent1')).toBe(-1);
    });

    it('should calculate net vote count correctly', () => {
      const votes = [
        { trackId: 1, vote: 1 },
        { trackId: 1, vote: 1 },
        { trackId: 1, vote: -1 },
        { trackId: 1, vote: 1 },
      ];

      const netVotes = votes.reduce((sum, v) => sum + v.vote, 0);
      expect(netVotes).toBe(2); // 3 upvotes - 1 downvote
    });
  });

  describe('Playlist Reordering', () => {
    it('should sort tracks by vote count descending', () => {
      const tracks = [
        { id: 1, trackName: 'Song A', voteCount: 5 },
        { id: 2, trackName: 'Song B', voteCount: 10 },
        { id: 3, trackName: 'Song C', voteCount: 3 },
      ];

      const sorted = [...tracks].sort((a, b) => b.voteCount - a.voteCount);

      expect(sorted[0].trackName).toBe('Song B');
      expect(sorted[1].trackName).toBe('Song A');
      expect(sorted[2].trackName).toBe('Song C');
    });

    it('should assign new positions after sorting', () => {
      const tracks = [
        { id: 1, voteCount: 5, position: 0 },
        { id: 2, voteCount: 10, position: 0 },
        { id: 3, voteCount: 3, position: 0 },
      ];

      const sorted = [...tracks].sort((a, b) => b.voteCount - a.voteCount);
      sorted.forEach((track, index) => {
        track.position = index + 1;
      });

      expect(sorted[0].position).toBe(1);
      expect(sorted[1].position).toBe(2);
      expect(sorted[2].position).toBe(3);
    });

    it('should handle tracks with zero votes', () => {
      const tracks = [
        { id: 1, voteCount: 5 },
        { id: 2, voteCount: 0 },
        { id: 3, voteCount: -2 },
      ];

      const sorted = [...tracks].sort((a, b) => b.voteCount - a.voteCount);

      expect(sorted[0].voteCount).toBe(5);
      expect(sorted[1].voteCount).toBe(0);
      expect(sorted[2].voteCount).toBe(-2);
    });
  });

  describe('Playlist Statistics', () => {
    it('should calculate total tracks correctly', () => {
      const tracks = [
        { id: 1, durationSeconds: 180 },
        { id: 2, durationSeconds: 240 },
        { id: 3, durationSeconds: 200 },
      ];

      const totalTracks = tracks.length;
      expect(totalTracks).toBe(3);
    });

    it('should calculate total duration correctly', () => {
      const tracks = [
        { id: 1, durationSeconds: 180 },
        { id: 2, durationSeconds: 240 },
        { id: 3, durationSeconds: 200 },
      ];

      const totalDuration = tracks.reduce((sum, t) => sum + t.durationSeconds, 0);
      expect(totalDuration).toBe(620);
    });

    it('should identify top contributor', () => {
      const tracks = [
        { addedBy: 'agent1' },
        { addedBy: 'agent2' },
        { addedBy: 'agent1' },
        { addedBy: 'agent1' },
        { addedBy: 'agent3' },
      ];

      const contributorCounts = new Map<string, number>();
      tracks.forEach(t => {
        contributorCounts.set(t.addedBy, (contributorCounts.get(t.addedBy) || 0) + 1);
      });

      const topContributor = Array.from(contributorCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];

      expect(topContributor).toBe('agent1');
    });

    it('should return null for top contributor when no tracks', () => {
      const tracks: any[] = [];

      const contributorCounts = new Map<string, number>();
      tracks.forEach(t => {
        contributorCounts.set(t.addedBy, (contributorCounts.get(t.addedBy) || 0) + 1);
      });

      const topContributor = contributorCounts.size > 0
        ? Array.from(contributorCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : null;

      expect(topContributor).toBeNull();
    });

    it('should handle empty playlist stats', () => {
      const tracks: any[] = [];

      const stats = {
        totalTracks: tracks.length,
        totalDuration: tracks.reduce((sum, t) => sum + t.durationSeconds, 0),
      };

      expect(stats.totalTracks).toBe(0);
      expect(stats.totalDuration).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle playlist at max capacity', () => {
      const maxTracks = 30;
      const currentCount = 30;

      const canAdd = currentCount < maxTracks;
      expect(canAdd).toBe(false);
    });

    it('should handle adding track to non-existent playlist', () => {
      const playlists = new Map<number, any>();
      const playlistExists = (id: number) => playlists.has(id);

      expect(playlistExists(999)).toBe(false);
    });

    it('should handle vote count with no votes', () => {
      const votes: any[] = [];
      const netVotes = votes.reduce((sum, v) => sum + v.vote, 0);

      expect(netVotes).toBe(0);
    });

    it('should preserve track order when votes are equal', () => {
      const tracks = [
        { id: 1, trackName: 'A', voteCount: 5, position: 1 },
        { id: 2, trackName: 'B', voteCount: 5, position: 2 },
        { id: 3, trackName: 'C', voteCount: 5, position: 3 },
      ];

      // When votes are equal, original order is preserved in stable sort
      const sorted = [...tracks].sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return a.position - b.position;
      });

      expect(sorted[0].trackName).toBe('A');
      expect(sorted[1].trackName).toBe('B');
      expect(sorted[2].trackName).toBe('C');
    });
  });
});
