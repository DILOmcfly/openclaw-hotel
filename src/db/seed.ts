import postgres from 'postgres';
import { config } from '../config.js';

const defaultRooms = [
  {
    name: 'Lobby',
    slug: 'lobby',
    description: 'Main gathering room',
    heightmap:
      'xxxxxxxxxxxx|x22221111000x|x22221111000x|x22221111000x|x22221111000x|x11111111000x|x00000000000x|x00000000000x|xxxxxxxxxxxx',
  },
  {
    name: 'Dev',
    slug: 'dev',
    description: 'Builder and debugging room',
    heightmap: 'xxxxxxxxxx|x11110000x|x11110000x|x11110000x|x00001111x|x00001111x|xxxxxxxxxx',
  },
  {
    name: 'Random',
    slug: 'random',
    description: 'Casual hangout',
    heightmap: 'xxxxxxxxxx|x00001111x|x00112211x|x00112211x|x11110000x|x11110000x|xxxxxxxxxx',
  },
] as const;

async function run(): Promise<void> {
  const sql = postgres(config.database.url);

  try {
    for (const room of defaultRooms) {
      await sql`
        INSERT INTO rooms (name, slug, description, is_public, heightmap)
        VALUES (${room.name}, ${room.slug}, ${room.description}, ${true}, ${room.heightmap})
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_public = EXCLUDED.is_public,
          heightmap = EXCLUDED.heightmap
      `;
    }

    // eslint-disable-next-line no-console
    console.log(`Seeded ${defaultRooms.length} rooms`);
  } finally {
    await sql.end();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
