const knex = require('knex');
const knexConfig = require('./knexfile');

// สร้าง connection สำหรับ Master Database
const masterDb = knex(knexConfig.master);

// สร้าง connection สำหรับ Slave Database
const slaveDb = knex(knexConfig.slave);

// สร้าง connection สำหรับ Offline Database
const offlineDb = knex(knexConfig.offline);

// เพิ่ม event handlers สำหรับ connection pool
masterDb.client.pool.on('createSuccess', () => {
  console.log('✓ Master DB connection created');
});

masterDb.client.pool.on('createFail', (err) => {
  console.error('✗ Master DB connection failed:', err.message);
});

slaveDb.client.pool.on('createFail', (err) => {
  console.error('✗ Slave DB connection failed:', err.message);
});

offlineDb.client.pool.on('createSuccess', () => {
  console.log('✓ Offline DB connection created');
});

offlineDb.client.pool.on('createFail', (err) => {
  console.error('✗ Offline DB connection failed:', err.message);
});

// ทดสอบ connection พร้อม retry logic
const testConnections = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await masterDb.raw('SELECT 1');
      console.log('✓ Master database connected successfully');
      break;
    } catch (error) {
      console.error(`✗ Master database connection failed (attempt ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  for (let i = 0; i < retries; i++) {
    try {
      await slaveDb.raw('SELECT 1');
      console.log('✓ Slave database connected successfully');
      break;
    } catch (error) {
      console.error(`✗ Slave database connection failed (attempt ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  for (let i = 0; i < retries; i++) {
    try {
      await offlineDb.raw('SELECT 1');
      console.log('✓ Offline database connected successfully');
      break;
    } catch (error) {
      console.error(`✗ Offline database connection failed (attempt ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// ฟังก์ชันตรวจสอบและ reconnect ถ้าจำเป็น
const ensureConnection = async (db, name) => {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch (error) {
    console.error(`${name} connection lost, attempting to reconnect...`);
    try {
      await db.raw('SELECT 1');
      console.log(`${name} reconnected successfully`);
      return true;
    } catch (retryError) {
      console.error(`${name} reconnection failed:`, retryError.message);
      return false;
    }
  }
};

module.exports = {
  masterDb,
  offlineDb,
  testConnections,
  ensureConnection
};
