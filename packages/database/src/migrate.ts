#!/usr/bin/env node

import { migrator } from './migrator';
import { db } from './connection';

async function main() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Test connection first
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }

    await migrator.migrate();
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();