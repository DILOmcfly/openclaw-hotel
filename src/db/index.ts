import postgres from 'postgres';
import { config } from '../config.js';

export const sql = postgres(config.databaseUrl);
export const db = sql; // Alias used by some routes
