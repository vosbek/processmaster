#!/usr/bin/env node

import { migrator } from './migrator';
import { db } from './connection';

async function main() {
  try {
    console.log('📊 Checking database status...');
    
    // Test connection first
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }

    await migrator.status();
    
    // Show table count
    const result = await db.query(`
      SELECT 
        schemaname,
        tablename
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    console.log('📋 Database Tables:');
    console.log('==================');
    result.rows.forEach((row: any) => {
      console.log(`• ${row.tablename}`);
    });
    console.log(`\nTotal tables: ${result.rows.length}`);

    // Show user count
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    console.log(`\n👥 Users: ${userCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Status check failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();