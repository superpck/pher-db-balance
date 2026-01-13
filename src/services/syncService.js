const dayjs = require('dayjs');
const { masterDb, offlineDb, ensureConnection } = require('../config/database');
const BACKWARD_MINUTE = process.env.BACKWARD_MINUTE || 20;

/**
 * อ่านข้อมูลจาก Master Database
 */
const readFromMaster = async (tableName, filters = {}) => {
  try {
    // ตรวจสอบ connection ก่อนใช้งาน
    await ensureConnection(masterDb, 'Master DB');

    let query = masterDb(tableName);

    // เพิ่ม filters ถ้ามี
    if (Object.keys(filters).length > 0) {
      query = query.where(filters);
    }

    const data = await query.select('*');
    return {
      success: true,
      data: data,
      count: data.length
    };
  } catch (error) {
    console.error('Error reading from master:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * บันทึกข้อมูลไปยัง Offline Database
 */
const writeToOffline = async (tableName, data) => {
  try {
    if (Array.isArray(data) && data.length > 0) {
      // Insert multiple records
      await offlineDb(tableName).insert(data);
      return {
        success: true,
        message: `Inserted ${data.length} records to offline database`
      };
    } else if (typeof data === 'object') {
      // Insert single record
      await offlineDb(tableName).insert(data);
      return {
        success: true,
        message: 'Inserted 1 record to offline database'
      };
    } else {
      return {
        success: false,
        error: 'Invalid data format'
      };
    }
  } catch (error) {
    console.error('Error writing to offline:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Sync ข้อมูลจาก Master ไป Offline
 */
const syncMasterToOffline = async (tableName, filters = {}, options = {}) => {
  try {
    // อ่านข้อมูลจาก Master
    const masterResult = await readFromMaster(tableName, filters);

    if (!masterResult.success) {
      return {
        success: false,
        error: `Failed to read from master: ${masterResult.error}`
      };
    }

    if (masterResult.count === 0) {
      return {
        success: true,
        message: 'No data to sync',
        synced: 0
      };
    }

    // ถ้ามี option truncate ให้ล้างข้อมูลเดิมใน offline ก่อน
    if (options.truncate) {
      await offlineDb(tableName).truncate();
    }

    // บันทึกข้อมูลไปยัง Offline
    const offlineResult = await writeToOffline(tableName, masterResult.data);

    if (!offlineResult.success) {
      return {
        success: false,
        error: `Failed to write to offline: ${offlineResult.error}`
      };
    }

    return {
      success: true,
      message: 'Data synced successfully',
      synced: masterResult.count,
      data: masterResult.data
    };
  } catch (error) {
    console.error('Error syncing data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Upsert ข้อมูลไปยัง Offline Database (Insert หรือ Update)
 */
const upsertToOffline = async (databaseName, tableName, data, refColumn = 'ref') => {
  tableName = `${databaseName}.${tableName}`;
  try {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: true,
        inserted: 0,
        updated: 0,
        message: 'No data to upsert'
      };
    }

    let insertedCount = 0;
    let updatedCount = 0;

    // ใช้ batch processing ทีละ 100 records เพื่อป้องกัน timeout
    const BATCH_SIZE = 100;
    const batches = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      batches.push(data.slice(i, i + BATCH_SIZE));
    }

    console.log(`  → Processing ${batches.length} batches of max ${BATCH_SIZE} records each`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // ใช้ transaction สำหรับแต่ละ batch
      await offlineDb.transaction(async (trx) => {
        for (const record of batch) {
          if (!record[refColumn]) {
            console.warn(`  ⚠ Record missing ${refColumn}, skipping`);
            continue;
          }

          // ตรวจสอบว่ามีข้อมูลอยู็แล้วหรือไม่
          const existing = await trx(tableName)
            .where(refColumn, record[refColumn])
            .first();

          if (existing) {
            // Update
            await trx(tableName)
              .where(refColumn, record[refColumn])
              .update(record);
            updatedCount++;
          } else {
            // Insert
            await trx(tableName).insert(record);
            insertedCount++;
          }
        }
      });

      // แสดงความคืบหน้า
      if ((batchIndex + 1) % 10 === 0 || batchIndex === batches.length - 1) {
        console.log(`  → Processed ${batchIndex + 1}/${batches.length} batches (${insertedCount} inserted, ${updatedCount} updated)`);
      }
    }

    return {
      success: true,
      inserted: insertedCount,
      updated: updatedCount,
      total: insertedCount + updatedCount,
      message: `Inserted ${insertedCount}, Updated ${updatedCount} records`
    };
  } catch (error) {
    console.error('Error upserting to offline:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Sync ตาราง iswin.is โดยใช้ updateColumn ย้อนหลัง BACKWARD_MINUTE นาที และ upsert ตาม ref
 */
const syncIswinWithUpsert = async (config) => {
  // ตรวจสอบ connection ก่อนใช้งาน
  await ensureConnection(masterDb, 'Master DB');
  await ensureConnection(offlineDb, 'Offline DB');

  if (['isdb_log', 'iswin'].includes(config.databaseName) && ['is_patient','is'].includes(config.table) && ['12:00','23:58'].includes(dayjs().format('HH:mm'))) {
    // ตรวจสอบย้อนหลัง 2 วัน ทุก 23:00 น.
    const columnName = config.databaseName == 'iswin' && config.table == 'is' ? 'adate' : config.updateColumn;
    let startDate = dayjs().subtract(2, 'day').format('YYYY-MM-DD') + ' 00:00:00';
    const finishDate = dayjs().subtract(BACKWARD_MINUTE, 'minute').format('YYYY-MM-DD HH:mm:ss');
    let results = [];
    do {
      const endDate = dayjs(startDate).add(4, 'hours').format('YYYY-MM-DD HH:mm:ss');
      const result = await syncData(config, startDate, endDate, columnName);
      results.push(result);
      startDate = dayjs(startDate).add(4, 'hours').format('YYYY-MM-DD HH:mm:ss');
    } while (startDate < finishDate);
    return results;
  } else {
    // คำนวณเวลาย้อนหลัง BACKWARD_MINUTE นาที
    const startDate = dayjs().subtract(BACKWARD_MINUTE, 'minute').format('YYYY-MM-DD HH:mm:ss');
    const endDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
    return await syncData(config, startDate, endDate);
  }
}

const syncData = async (config, startDate, endDate, columnName='') => {
  //config.databaseName, config.table, config.refColumn, config.updateColumn
  try {
    columnName = columnName || config.updateColumn;
    console.log(`  → Reading from ${config.databaseName}.${config.table} where ${columnName} '${startDate}' to '${endDate}'`);

    // // อ่านข้อมูลจาก Master ที่ updateColumn ย้อนหลัง BACKWARD_MINUTE นาที
    let masterData = await masterDb(`${config.databaseName}.${config.table}`)
      .whereBetween(columnName, [startDate, endDate])
      .select('*');

    if (masterData.length === 0) {
      return {
        success: true,
        message: 'No new data to sync',
        inserted: 0,
        updated: 0,
        total: 0
      };
    }

    // แปลง raw_data (JSON type) ให้เป็น string ว่าง
    masterData = masterData.map(record => {
      if (record?.raw_data !== undefined && record?.raw_data !== null) {
        record.raw_data = null;
      }
      return record;
    });

    console.log(`  → Found ${masterData.length} records to sync`);

    // Upsert ข้อมูลไปยัง Offline
    const upsertResult = await upsertToOffline(config.databaseName, config.table, masterData, config.refColumn);

    if (!upsertResult.success) {
      return {
        success: false,
        error: `Failed to upsert to offline: ${upsertResult.error}`
      };
    }

    return {
      success: true,
      message: upsertResult.message,
      inserted: upsertResult.inserted,
      updated: upsertResult.updated,
      total: upsertResult.total,
      data: masterData
    };
  } catch (error) {
    console.error('Error syncing iswin data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * ลบข้ตรวจสอบ connection ก่อนใช้งาน
    await ensureConnection(masterDb, 'Master DB');
    await ensureConnection(offlineDb, 'Offline DB');
    
    // อมูลจาก Offline Database ตาม DELETE log จาก isdb_log.is_log
 */
const deleteIswinFromLog = async (tableName = 'is', refColumn = 'ref') => {
  try {
    // คำนวณเวลาย้อนหลัง BACKWARD_MINUTE นาที
    const startDate = dayjs().subtract(BACKWARD_MINUTE, 'minute').format('YYYY-MM-DD HH:mm:ss');
    const endDate = dayjs().format('YYYY-MM-DD HH:mm:ss');

    console.log(`  → Reading DELETE logs from isdb_log.is_log where log_date '${startDate}' to '${endDate}'`);

    // อ่าน log จาก isdb_log.is_log ที่เป็น DELETE และ log_date ย้อนหลัง BACKWARD_MINUTE นาที
    const deleteLogs = await masterDb('isdb_log.is_log')
      .whereBetween('log_date', [startDate, endDate])
      .where('log_type', 'DELETE')
      .select('ref');

    if (deleteLogs.length === 0) {
      return {
        success: true,
        message: 'No delete logs to process',
        deleted: 0
      };
    }

    console.log(`  → Found ${deleteLogs.length} DELETE logs to process`);

    // ลบข้อมูลจาก Offline ตาม ref ที่พบใน log
    const refsToDelete = deleteLogs.map(log => log.ref).filter(ref => ref);

    if (refsToDelete.length === 0) {
      return {
        success: true,
        message: 'No valid refs to delete',
        deleted: 0
      };
    }

    const deletedCount = await offlineDb(tableName)
      .whereIn(refColumn, refsToDelete)
      .del();

    return {
      success: true,
      message: `Deleted ${deletedCount} records from offline`,
      deleted: deletedCount,
      refs: refsToDelete
    };
  } catch (error) {
    console.error('Error deleting from log:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * เปรียบเทียบข้อมูลระหว่าง Master และ Offline
 */
const compareData = async (tableName, filters = {}) => {
  try {
    const masterResult = await readFromMaster(tableName, filters);

    let offlineQuery = offlineDb(tableName);
    if (Object.keys(filters).length > 0) {
      offlineQuery = offlineQuery.where(filters);
    }
    const offlineData = await offlineQuery.select('*');

    return {
      success: true,
      master: {
        count: masterResult.count,
        data: masterResult.data
      },
      offline: {
        count: offlineData.length,
        data: offlineData
      }
    };
  } catch (error) {
    console.error('Error comparing data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  readFromMaster,
  writeToOffline,
  syncMasterToOffline,
  upsertToOffline,
  syncIswinWithUpsert,
  deleteIswinFromLog,
  compareData
};
