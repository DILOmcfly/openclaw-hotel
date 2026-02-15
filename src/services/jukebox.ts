import { createId } from '@paralleldrive/cuid2';

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

const MAX_TRACKS = 20;

export async function setPlaylist(
  roomId: string,
  tracks: Track[],
  sql: any
): Promise<PlaylistState> {
  if (tracks.length > MAX_TRACKS) {
    throw new Error(`Playlist cannot exceed ${MAX_TRACKS} tracks`);
  }

  const existing = await sql`
    SELECT id FROM room_playlists WHERE room_id = ${roomId}
  `;

  const now = new Date();

  if (existing.length > 0) {
    const result = await sql`
      UPDATE room_playlists
      SET tracks = ${JSON.stringify(tracks)}::jsonb,
          current_track = 0,
          is_playing = false,
          updated_at = ${now}
      WHERE room_id = ${roomId}
      RETURNING *
    `;
    return mapRowToPlaylistState(result[0]);
  } else {
    const id = createId();
    const result = await sql`
      INSERT INTO room_playlists (id, room_id, tracks, current_track, is_playing, updated_at)
      VALUES (${id}, ${roomId}, ${JSON.stringify(tracks)}::jsonb, 0, false, ${now})
      RETURNING *
    `;
    return mapRowToPlaylistState(result[0]);
  }
}

export async function play(roomId: string, sql: any): Promise<PlaylistState> {
  const result = await sql`UPDATE room_playlists SET is_playing = true, updated_at = NOW() WHERE room_id = ${roomId} RETURNING *`;
  if (result.length === 0) throw new Error('Playlist not found');
  return mapRowToPlaylistState(result[0]);
}

export async function pause(roomId: string, sql: any): Promise<PlaylistState> {
  const result = await sql`UPDATE room_playlists SET is_playing = false, updated_at = NOW() WHERE room_id = ${roomId} RETURNING *`;
  if (result.length === 0) throw new Error('Playlist not found');
  return mapRowToPlaylistState(result[0]);
}

export async function nextTrack(roomId: string, sql: any): Promise<PlaylistState> {
  const playlist = await getPlaylist(roomId, sql);
  if (!playlist) throw new Error('Playlist not found');
  
  let nextIndex = playlist.currentTrack;
  if (playlist.repeatMode === 'one') {
    nextIndex = playlist.currentTrack;
  } else if (playlist.repeatMode === 'all') {
    nextIndex = (playlist.currentTrack + 1) % playlist.tracks.length;
  } else {
    nextIndex = Math.min(playlist.tracks.length - 1, playlist.currentTrack + 1);
  }

  const result = await sql`UPDATE room_playlists SET current_track = ${nextIndex}, updated_at = NOW() WHERE room_id = ${roomId} RETURNING *`;
  return mapRowToPlaylistState(result[0]);
}

export async function prevTrack(roomId: string, sql: any): Promise<PlaylistState> {
  const playlist = await getPlaylist(roomId, sql);
  if (!playlist) throw new Error('Playlist not found');
  const prevIndex = Math.max(0, playlist.currentTrack - 1);
  const result = await sql`UPDATE room_playlists SET current_track = ${prevIndex}, updated_at = NOW() WHERE room_id = ${roomId} RETURNING *`;
  return mapRowToPlaylistState(result[0]);
}

export async function setVolume(roomId: string, volume: number, sql: any): Promise<PlaylistState> {
  if (volume < 0 || volume > 100) throw new Error('Volume must be between 0 and 100');
  const result = await sql`UPDATE room_playlists SET volume = ${volume}, updated_at = NOW() WHERE room_id = ${roomId} RETURNING *`;
  if (result.length === 0) throw new Error('Playlist not found');
  return mapRowToPlaylistState(result[0]);
}

export async function setRepeatMode(roomId: string, mode: 'none' | 'one' | 'all', sql: any): Promise<PlaylistState> {
  if (!['none', 'one', 'all'].includes(mode)) throw new Error('Invalid repeat mode');
  const result = await sql`UPDATE room_playlists SET repeat_mode = ${mode}, updated_at = NOW() WHERE room_id = ${roomId} RETURNING *`;
  if (result.length === 0) throw new Error('Playlist not found');
  return mapRowToPlaylistState(result[0]);
}

export async function getPlaylist(roomId: string, sql: any): Promise<PlaylistState | null> {
  const result = await sql`
    SELECT * FROM room_playlists WHERE room_id = ${roomId}
  `;

  if (result.length === 0) {
    return null;
  }

  return mapRowToPlaylistState(result[0]);
}

export async function addTrack(roomId: string, track: Track, sql: any): Promise<PlaylistState> {
  const playlist = await getPlaylist(roomId, sql);
  if (!playlist) return setPlaylist(roomId, [track], sql);
  if (playlist.tracks.length >= MAX_TRACKS) throw new Error(`Playlist cannot exceed ${MAX_TRACKS} tracks`);
  
  const updatedTracks = [...playlist.tracks, track];
  const result = await sql`UPDATE room_playlists SET tracks = ${JSON.stringify(updatedTracks)}::jsonb, updated_at = NOW() WHERE room_id = ${roomId} RETURNING *`;
  return mapRowToPlaylistState(result[0]);
}

export async function removeTrack(roomId: string, trackIndex: number, sql: any): Promise<PlaylistState> {
  const playlist = await getPlaylist(roomId, sql);
  if (!playlist) throw new Error('Playlist not found');
  if (trackIndex < 0 || trackIndex >= playlist.tracks.length) throw new Error('Invalid track index');

  const updatedTracks = playlist.tracks.filter((_, idx) => idx !== trackIndex);
  let newCurrentTrack = playlist.currentTrack;
  if (trackIndex <= playlist.currentTrack && newCurrentTrack > 0) newCurrentTrack--;
  if (newCurrentTrack >= updatedTracks.length && updatedTracks.length > 0) newCurrentTrack = updatedTracks.length - 1;

  const result = await sql`UPDATE room_playlists SET tracks = ${JSON.stringify(updatedTracks)}::jsonb, current_track = ${newCurrentTrack}, updated_at = NOW() WHERE room_id = ${roomId} RETURNING *`;
  return mapRowToPlaylistState(result[0]);
}

function mapRowToPlaylistState(row: any): PlaylistState {
  return {
    id: row.id,
    roomId: row.room_id,
    tracks: row.tracks,
    currentTrack: row.current_track,
    isPlaying: row.is_playing,
    volume: row.volume,
    repeatMode: row.repeat_mode,
    updatedAt: row.updated_at,
  };
}
