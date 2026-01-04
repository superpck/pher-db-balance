const dayjs = require('dayjs');
const { syncMasterToOffline, syncIswinWithUpsert, deleteIswinFromLog } = require('../services/syncService');

/**
 * กำหนดตารางและ filters ที่ต้องการ sync
 * แก้ไขตามความต้องการของคุณ
 */
const SYNC_CONFIG = [
  {
    databaseName: 'iswin',
    table: 'is',
    type: 'iswin_upsert', // ใช้ upsert สำหรับ iswin.is
    refColumn: 'ref', // คอลัมน์ที่ใช้ตรวจสอบ (PK)
    updateColumn: 'lastupdate'  // ตรวจสอบ last date
  },
  {
    databaseName: 'isdb_log',
    table: 'is',
    type: 'iswin_delete', // ลบข้อมูลตาม DELETE log
    refColumn: 'ref',
    updateColumn: 'lastupdate'
  },
  {
    databaseName: 'iswin',
    table: 'is_patient',
    type: 'iswin_upsert',
    refColumn: 'patient_id',
    updateColumn: 'lastupdate'
  },
  {
    databaseName: 'iswin',
    table: 'user',
    type: 'iswin_upsert',
    refColumn: 'id',
    updateColumn: 'lastupdate'
  },
  {
    databaseName: 'iswin',
    table: 'is_diagnosis',
    type: 'iswin_upsert',
    refColumn: 'ref',
    updateColumn: 'lastupdate'
  },
  {
    databaseName: 'iswin',
    table: 'token',
    type: 'iswin_upsert',
    refColumn: 'ref',
    updateColumn: 'lastupdate'
  },
  {
    databaseName: 'iswin',
    table: 'user_reset_token',
    type: 'iswin_upsert',
    refColumn: 'ref',
    updateColumn: 'lastupdate'
  },
  {
    databaseName: 'iswin',
    table: 'accident_location',
    type: 'iswin_upsert',
    refColumn: 'id',
    updateColumn: 'lastupdate'
  },
  {
    databaseName: 'iswin',
    table: 'festival',
    type: 'iswin_upsert',
    refColumn: 'id',
    updateColumn: 'lastupdate'
  },
  // เพิ่มตารางอื่น ๆ ที่ต้องการ sync แบบปกติ
  // {
  //   table: 'orders',
  //   type: 'normal',
  //   filters: { created_at: '2026-01-01' },
  //   options: { truncate: false }
  // },
];

/**
 * ฟังก์ชันสำหรับรัน sync ตาม schedule
 */
const runScheduledSync = async () => {
  const startTime = dayjs();
  console.log(`[${startTime.format('YYYY-MM-DD HH:mm:ss')}] Starting scheduled sync...`);

  const results = [];

  let tblCount = 0;
  for (const config of SYNC_CONFIG) {
    tblCount++;
    try {
      console.log(` ${tblCount}/${SYNC_CONFIG.length} Syncing table: ${config.databaseName}.${config.table}`);

      let result;

      if (config.type === 'iswin_upsert') {
        // ใช้ syncIswinWithUpsert สำหรับ iswin
        result = await syncIswinWithUpsert(config);

        results.push({
          table: config.table,
          success: result.success,
          inserted: result.inserted || 0,
          updated: result.updated || 0,
          total: result.total || 0,
          message: result.message || result.error
        });

        if (result.success) {
          console.log(`  ✓ ${config.table}: ${result.inserted} inserted, ${result.updated} updated (total: ${result.total})`);
        } else {
          console.error(`  ✗ ${config.table}: ${result.error}`);
        }
      } else if (config.type === 'iswin_delete') {
        // ใช้ deleteIswinFromLog สำหรับลบข้อมูลตาม DELETE log
        result = await deleteIswinFromLog(config.table, config.refColumn);

        results.push({
          table: config.table,
          success: result.success,
          deleted: result.deleted || 0,
          message: result.message || result.error
        });

        if (result.success) {
          console.log(`  ✓ ${config.table} (DELETE): ${result.deleted} records deleted`);
        } else {
          console.error(`  ✗ ${config.table} (DELETE): ${result.error}`);
        }
      } else {
        // ใช้ syncMasterToOffline แบบปกติ
        result = await syncMasterToOffline(
          config.table,
          config.filters || {},
          config.options || {}
        );

        results.push({
          table: config.table,
          success: result.success,
          synced: result.synced || 0,
          message: result.message || result.error
        });

        if (result.success) {
          console.log(`  ✓ ${config.table}: ${result.synced} records synced`);
        } else {
          console.error(`  ✗ ${config.table}: ${result.error}`);
        }
      }
      console.log('-'.repeat(60));
    } catch (error) {
      console.error(`  ✗ ${config.table}: ${error.message}`);
      results.push({
        table: config.table,
        success: false,
        error: error.message
      });
    }
  }

  const endTime = dayjs();
  const duration = endTime.diff(startTime, 'second', true);

  console.log(`[${endTime.format('YYYY-MM-DD HH:mm:ss')}] Sync completed in ${duration.toFixed(3)}s`);
  console.log(`  Total tables: ${results.length}`);
  console.log(`  Successful: ${results.filter(r => r.success).length}`);
  console.log(`  Failed: ${results.filter(r => !r.success).length}\n`);

  return results;
};

module.exports = {
  runScheduledSync,
  SYNC_CONFIG
};
