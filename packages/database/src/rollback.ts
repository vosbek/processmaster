#!/usr/bin/env node

import { migrator } from './migrator';
import { db } from './connection';

async function main() {
  try {
    const steps = parseInt(process.argv[2]) || 1;
    
    console.log(`🔄 Rolling back ${steps} migration(s)...`);
    
    // Test connection first
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }

    await migrator.rollback(steps);
    console.log('🎉 Rollback completed successfully!');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();