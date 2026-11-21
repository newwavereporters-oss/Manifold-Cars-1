import fs from 'fs';
import path from 'path';
import type { Response } from 'express';

const DB_MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/db');

const ALLOWED_MIGRATION_FILES = new Set([
  'market-intelligence-migration.sql',
  'game-world-social-migration.sql',
  'dealer-approval-migration.sql',
  'ai-platform-migration.sql',
  'admin-auth-fix.sql',
]);

export function sendMigrationSqlFile(filename: string, notFoundComment: string, res: Response): void {
  if (!ALLOWED_MIGRATION_FILES.has(filename)) {
    res.status(404).send(notFoundComment);
    return;
  }

  const resolved = path.resolve(DB_MIGRATIONS_DIR, filename);
  if (!resolved.startsWith(DB_MIGRATIONS_DIR + path.sep)) {
    res.status(403).send('-- Invalid migration file path.');
    return;
  }

  if (fs.existsSync(resolved)) {
    const sql = fs.readFileSync(resolved, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(sql);
    return;
  }

  res.status(404).send(notFoundComment);
}
