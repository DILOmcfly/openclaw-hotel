/**
 * Room Playlists Service - Manages shared music playlists in rooms
 */

export type Playlist = {
  id: number;
  roomId: number;
  name: string;
  maxTracks: number;
  shuffle: boolean;
  createdAt: Date;
};

export type PlaylistTrack = {
  id: number;
  playlistId: number;
  addedBy: string;
  trackName: string;
  artist: string;
  durationSeconds: number;
  position: number;
  addedAt: Date;
  voteCount?: number;
};

export type PlaylistStats = {
  totalTracks: number;
  totalDuration: number;
  topContributor: string | null;
};

export async function createPlaylist(roomId: number, name: string, sql: any): Promise<Playlist> {
  const result = await sql`
    INSERT INTO room_playlists (room_id, name)
    VALUES (${roomId}, ${name})
    RETURNING id, room_id AS "roomId", name, max_tracks AS "maxTracks", shuffle, created_at AS "createdAt"
  `;
  return result[0];
}

export async function addTrack(
  playlistId: number,
  trackName: string,
  artist: string,
  durationSeconds: number,
  addedBy: string,
  sql: any
): Promise<PlaylistTrack | null> {
  const [playlist, trackCount, maxPos] = await Promise.all([
    sql`SELECT max_tracks AS "maxTracks" FROM room_playlists WHERE id = ${playlistId}`,
    sql`SELECT COUNT(*) AS count FROM playlist_tracks WHERE playlist_id = ${playlistId}`,
    sql`SELECT COALESCE(MAX(position), 0) AS max FROM playlist_tracks WHERE playlist_id = ${playlistId}`,
  ]);

  if (playlist.length === 0 || parseInt(trackCount[0].count) >= playlist[0].maxTracks) {
    return null;
  }

  const nextPosition = maxPos[0].max + 1;
  const result = await sql`
    INSERT INTO playlist_tracks (playlist_id, added_by, track_name, artist, duration_seconds, position)
    VALUES (${playlistId}, ${addedBy}, ${trackName}, ${artist}, ${durationSeconds}, ${nextPosition})
    RETURNING id, playlist_id AS "playlistId", added_by AS "addedBy", track_name AS "trackName",
      artist, duration_seconds AS "durationSeconds", position, added_at AS "addedAt"
  `;
  return result[0];
}

export async function removeTrack(trackId: number, agentId: string, roomOwnerId: string, sql: any): Promise<boolean> {
  const track = await sql`SELECT added_by AS "addedBy" FROM playlist_tracks WHERE id = ${trackId}`;
  if (track.length === 0 || (track[0].addedBy !== agentId && roomOwnerId !== agentId)) {
    return false;
  }
  await sql`DELETE FROM playlist_tracks WHERE id = ${trackId}`;
  return true;
}

export async function getTracks(playlistId: number, sql: any): Promise<PlaylistTrack[]> {
  return await sql`
    SELECT pt.id, pt.playlist_id AS "playlistId", pt.added_by AS "addedBy", pt.track_name AS "trackName",
      pt.artist, pt.duration_seconds AS "durationSeconds", pt.position, pt.added_at AS "addedAt",
      COALESCE(SUM(tv.vote), 0)::INTEGER AS "voteCount"
    FROM playlist_tracks pt
    LEFT JOIN track_votes tv ON pt.id = tv.track_id
    WHERE pt.playlist_id = ${playlistId}
    GROUP BY pt.id
    ORDER BY pt.position ASC
  `;
}

export async function voteTrack(trackId: number, agentId: string, vote: number, sql: any): Promise<boolean> {
  if (vote !== 1 && vote !== -1) return false;

  const existing = await sql`SELECT vote FROM track_votes WHERE track_id = ${trackId} AND agent_id = ${agentId}`;

  if (existing.length > 0) {
    if (existing[0].vote === vote) {
      await sql`DELETE FROM track_votes WHERE track_id = ${trackId} AND agent_id = ${agentId}`;
    } else {
      await sql`UPDATE track_votes SET vote = ${vote} WHERE track_id = ${trackId} AND agent_id = ${agentId}`;
    }
  } else {
    await sql`INSERT INTO track_votes (track_id, agent_id, vote) VALUES (${trackId}, ${agentId}, ${vote})`;
  }
  return true;
}

export async function reorderByVotes(playlistId: number, sql: any): Promise<void> {
  const tracks = await getTracks(playlistId, sql);
  const sorted = tracks.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

  // Batch update positions using VALUES clause
  if (sorted.length > 0) {
    const updates = sorted.map((track, index) => ({
      id: track.id,
      position: index + 1
    }));
    
    await sql`
      UPDATE playlist_tracks pt
      SET position = u.position
      FROM ${sql(updates)} AS u(id, position)
      WHERE pt.id = u.id
    `;
  }
}

export async function getPlaylistStats(playlistId: number, sql: any): Promise<PlaylistStats> {
  const result = await sql`
    SELECT COUNT(*) AS "totalTracks", COALESCE(SUM(duration_seconds), 0) AS "totalDuration",
      (SELECT added_by FROM playlist_tracks WHERE playlist_id = ${playlistId}
       GROUP BY added_by ORDER BY COUNT(*) DESC LIMIT 1) AS "topContributor"
    FROM playlist_tracks WHERE playlist_id = ${playlistId}
  `;

  return {
    totalTracks: parseInt(result[0].totalTracks),
    totalDuration: parseInt(result[0].totalDuration),
    topContributor: result[0].topContributor,
  };
}
