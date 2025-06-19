#!/usr/bin/env node

import { db } from './connection';

async function main() {
  try {
    console.log('🔍 Testing database connection...');
    
    const connected = await db.testConnection();
    
    if (connected) {
      console.log('✅ Database connection successful!');
      
      // Show basic info
      const result = await db.query(`
        SELECT 
          version() as postgres_version,
          current_database() as database_name,
          current_user as current_user
      `);
      
      console.log('\n📋 Database Information:');
      console.log('=======================');
      console.log(`PostgreSQL Version: ${result.rows[0].postgres_version.split(' ')[1]}`);
      console.log(`Database: ${result.rows[0].database_name}`);
      console.log(`User: ${result.rows[0].current_user}`);
      
    } else {
      console.error('❌ Database connection failed!');
      console.error('Please check your DATABASE_URL environment variable.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();