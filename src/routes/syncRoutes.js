const express = require('express');
const router = express.Router();
const syncService = require('../services/syncService');

/**
 * GET /api/sync/read/:table
 * อ่านข้อมูลจาก Master Database
 */
router.get('/read/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const filters = req.query; // รับ filters จาก query parameters
    
    const result = await syncService.readFromMaster(table, filters);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync/sync/:table
 * Sync ข้อมูลจาก Master ไป Offline
 */
router.post('/sync/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { filters = {}, options = {} } = req.body;
    
    const result = await syncService.syncMasterToOffline(table, filters, options);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sync/compare/:table
 * เปรียบเทียบข้อมูลระหว่าง Master และ Offline
 */
router.get('/compare/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const filters = req.query;
    
    const result = await syncService.compareData(table, filters);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
