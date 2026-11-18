/**
 * Vitest setup.
 *
 * Integration tests talk to the same PostgreSQL database the app uses, so the
 * connection string from `.env` must be available. CI provides `DATABASE_URL`
 * through the workflow environment; locally it comes from `.env`.
 */
import { config } from 'dotenv';

config({ quiet: true });
