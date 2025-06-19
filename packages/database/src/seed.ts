#!/usr/bin/env node

import { db } from './connection';
import bcrypt from 'bcryptjs';

async function seedData() {
  console.log('🌱 Seeding database with initial data...');

  try {
    // Create default organization
    const orgResult = await db.query(`
      INSERT INTO organizations (id, name, domain, is_active)
      VALUES (
        uuid_generate_v4(),
        'ProcessMaster Demo',
        'demo.processmaster.pro',
        true
      )
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `);

    let orgId;
    if (orgResult.rows.length > 0) {
      orgId = orgResult.rows[0].id;
      console.log(`✅ Created organization: ${orgResult.rows[0].name}`);
    } else {
      // Get existing organization
      const existingOrg = await db.query(`
        SELECT id, name FROM organizations WHERE domain = 'demo.processmaster.pro'
      `);
      orgId = existingOrg.rows[0].id;
      console.log(`ℹ️  Using existing organization: ${existingOrg.rows[0].name}`);
    }

    // Create demo admin user
    const passwordHash = await bcrypt.hash('admin123', 12);
    
    const userResult = await db.query(`
      INSERT INTO users (id, email, first_name, last_name, password_hash, role, is_active)
      VALUES (
        uuid_generate_v4(),
        'admin@demo.processmaster.pro',
        'Demo',
        'Admin',
        $1,
        'admin',
        true
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, first_name, last_name, role
    `, [passwordHash]);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`✅ Created admin user: ${user.first_name} ${user.last_name} (${user.email})`);

      // Add user to organization
      await db.query(`
        INSERT INTO user_organizations (user_id, organization_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (user_id, organization_id) DO NOTHING
      `, [user.id, orgId]);

      console.log(`✅ Added admin user to organization`);
    } else {
      console.log(`ℹ️  Admin user already exists: admin@demo.processmaster.pro`);
    }

    // Create demo regular user
    const userPasswordHash = await bcrypt.hash('user123', 12);
    
    const regularUserResult = await db.query(`
      INSERT INTO users (id, email, first_name, last_name, password_hash, role, is_active)
      VALUES (
        uuid_generate_v4(),
        'user@demo.processmaster.pro',
        'Demo',
        'User',
        $1,
        'user',
        true
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, first_name, last_name, role
    `, [userPasswordHash]);

    if (regularUserResult.rows.length > 0) {
      const user = regularUserResult.rows[0];
      console.log(`✅ Created regular user: ${user.first_name} ${user.last_name} (${user.email})`);

      // Add user to organization
      await db.query(`
        INSERT INTO user_organizations (user_id, organization_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (user_id, organization_id) DO NOTHING
      `, [user.id, orgId]);

      console.log(`✅ Added regular user to organization`);
    } else {
      console.log(`ℹ️  Regular user already exists: user@demo.processmaster.pro`);
    }

    console.log('\n🎉 Database seeding completed!');
    console.log('\n👤 Demo Accounts:');
    console.log('================');
    console.log('Admin: admin@demo.processmaster.pro / admin123');
    console.log('User:  user@demo.processmaster.pro / user123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

async function main() {
  try {
    // Test connection first
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Database connection failed. Please check your configuration.');
      process.exit(1);
    }

    await seedData();
  } catch (error) {
    console.error('❌ Seed process failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();