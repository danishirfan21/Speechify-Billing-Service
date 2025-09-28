import { teardownTestDatabase } from './dbSetup';

export default async function globalTeardown(): Promise<void> {
  await teardownTestDatabase();
}
