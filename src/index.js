require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const dayjs = require('dayjs');
const { testConnections } = require('./config/database');
const { runScheduledSync } = require('./jobs/syncJob');
const { checkBalance } = require('./jobs/check_balance');

const app = express();
const PORT = process.env.PORT || 3000;
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// Health check route only
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'DB Sync Cron Job is active',
    timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss')
  });
});

// Start cron job and server
const startCronJob = async () => {
  try {
    console.log('\n🚀 Starting DB Sync Cron Job...');

    // Test database connections
    await testConnections();

    // Setup cron job - ทำงานทุก 2 นาที
    cron.schedule('*/2 * * * *', async () => {
      console.log('\n⏰ Running scheduled sync...');
      await runScheduledSync();
    });

    // Report balance checking - ทำงานทุกวันเวลา 00:02 และ 12:02
    cron.schedule('0 2 0,12 * * *', async () => {
      console.log('\n📊 Running balance check...');
      runScheduledSync().then(async () => {
        await checkBalance();
      });
    });

    // Start Express server for health check
    app.listen(PORT, () => {
      console.log(`📍 Health check: http://localhost:${PORT}/`);
      console.log(`⏰ Sync job scheduled: Every 2 Minutes, Backward data: ${process.env.BACKWARD_MINUTE} minutes`);
      console.log('📊 Balance check scheduled: Daily at 00:02 and 12:02');
      console.log('✓ System is running. Press Ctrl+C to stop.\n');
    });

  } catch (error) {
    console.error('Failed to start cron job:', error);
    process.exit(1);
  }
};

startCronJob();
