import { PoolClient } from 'pg';
import { db } from './connection';
import * as fs from 'fs';
import * as path from 'path';

interface Migration {
  version: string;
  up: (client: PoolClient) => Promise<void>;
  down: (client: PoolClient) => Promise<void>;
}

export class Migrator {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  private async ensureMigrationsTable(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private async getAppliedMigrations(): Promise<string[]> {
    try {
      const result = await db.query('SELECT version FROM schema_migrations ORDER BY version');
      return result.rows.map((row: any) => row.version);
    } catch (error) {
      return [];
    }
  }

  private async getAvailableMigrations(): Promise<Migration[]> {
    const migrationFiles = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of migrationFiles) {
      const version = path.basename(file, path.extname(file));
      const migrationPath = path.join(this.migrationsDir, file);
      
      try {
        const migration = require(migrationPath);
        if (migration.up && migration.down) {
          migrations.push({
            version,
            up: migration.up,
            down: migration.down,
          });
        }
      } catch (error) {
        console.error(`Error loading migration ${file}:`, error);
      }
    }

    return migrations;
  }

  public async migrate(): Promise<void> {
    console.log('Starting database migration...');
    
    await this.ensureMigrationsTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();

    const pendingMigrations = availableMigrations.filter(
      migration => !appliedMigrations.includes(migration.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations.`);

    for (const migration of pendingMigrations) {
      console.log(`Applying migration: ${migration.version}`);
      
      await db.transaction(async (client) => {
        await migration.up(client);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [migration.version]
        );
      });

      console.log(`✅ Applied migration: ${migration.version}`);
    }

    console.log('Migration completed successfully!');
  }

  public async rollback(steps: number = 1): Promise<void> {
    console.log(`Rolling back ${steps} migration(s)...`);
    
    await this.ensureMigrationsTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();

    if (appliedMigrations.length === 0) {
      console.log('No migrations to rollback.');
      return;
    }

    const migrationsToRollback = appliedMigrations
      .slice(-steps)
      .reverse();

    for (const version of migrationsToRollback) {
      const migration = availableMigrations.find(m => m.version === version);
      
      if (!migration) {
        console.error(`Migration ${version} not found in available migrations.`);
        continue;
      }

      console.log(`Rolling back migration: ${version}`);
      
      await db.transaction(async (client) => {
        await migration.down(client);
        await client.query(
          'DELETE FROM schema_migrations WHERE version = $1',
          [version]
        );
      });

      console.log(`✅ Rolled back migration: ${version}`);
    }

    console.log('Rollback completed successfully!');
  }

  public async reset(): Promise<void> {
    console.log('Resetting database...');
    
    const appliedMigrations = await this.getAppliedMigrations();
    
    if (appliedMigrations.length > 0) {
      await this.rollback(appliedMigrations.length);
    }
    
    await this.migrate();
    
    console.log('Database reset completed!');
  }

  public async status(): Promise<void> {
    await this.ensureMigrationsTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();

    console.log('\n📊 Migration Status:');
    console.log('==================');

    for (const migration of availableMigrations) {
      const isApplied = appliedMigrations.includes(migration.version);
      const status = isApplied ? '✅ Applied' : '⏳ Pending';
      console.log(`${status} - ${migration.version}`);
    }

    const pendingCount = availableMigrations.length - appliedMigrations.length;
    console.log(`\nTotal: ${availableMigrations.length} migrations`);
    console.log(`Applied: ${appliedMigrations.length}`);
    console.log(`Pending: ${pendingCount}\n`);
  }
}

export const migrator = new Migrator();