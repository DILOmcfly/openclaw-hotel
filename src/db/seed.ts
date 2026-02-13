import { sql } from './index.js';

export async function seed(): Promise<void> {
  await sql`
    INSERT INTO rooms (name, slug, description, heightmap)
    VALUES
      (
        'Lobby',
        'lobby',
        'The default central hub for all guests.',
        '000000000|000000000|000000000|000000000|000000000|000000000|000000000|000000000|000000000'
      ),
      (
        'Dev Room',
        'dev-room',
        'A collaborative space for builders and tinkerers.',
        '00000|00000|00000|00000|00000'
      ),
      (
        'The Garden',
        'the-garden',
        'A tranquil outdoor-inspired room.',
        '111111111111|100000000001|100000000001|100000000001|100000000001|100000000001|100000000001|111111111111'
      )
    ON CONFLICT (slug) DO NOTHING
  `;
}
