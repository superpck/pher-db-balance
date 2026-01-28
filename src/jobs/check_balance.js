const dayjs = require('dayjs');
const axios = require('axios');
const { masterDb, offlineDb, ensureConnection } = require('../config/database');

/**
 * นับจำนวน cases จาก table is ตามวันที่
 */
const countCasesByDate = async (db, dbName, startDate, endDate) => {
  try {
    await ensureConnection(db, dbName);
    const result = await db('iswin.is')
      .select(db.raw('DATE(adate) as accdate'))
      .count('* as count')
      .whereBetween('adate', [startDate, endDate])
      .groupBy('accdate')
      .orderBy('accdate');
    return result;
  } catch (error) {
    console.error(`Error counting cases from ${dbName}:`, error);
    return [];
  }
};

/**
 * ส่ง notification ไป Telegram
 */
const sendTelegramNotification = async (message) => {
  try {
    const token = process.env.TOKEN;
    const chatId = process.env.CHAT_ID;

    if (!token || !chatId) {
      console.error('Missing Telegram TOKEN or CHAT_ID');
      return false;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    console.log('✓ Telegram notification sent successfully');
    return true;
  } catch (error) {
    console.error('✗ Failed to send Telegram notification:', error.message);
    return false;
  }
};

/**
 * ตรวจสอบและเปรียบเทียบจำนวน cases ระหว่าง master และ offline
 */
const checkBalance = async () => {
  const startTime = dayjs();
  console.log(`\n[${startTime.format('YYYY-MM-DD HH:mm:ss')}] 📊 Starting balance check...`);

  try {
    // คำนวณช่วงเวลา 7 วันย้อนหลัง (ควร run node-cron ก่อน 3 นาที เช่น 00:02, 12:02)
    const endDate = dayjs().subtract(10, 'minutes').endOf('hour').format('YYYY-MM-DD HH:mm:ss');
    const startDate = dayjs(endDate).subtract(7, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');

    console.log(`  → Checking cases from ${startDate} to ${endDate}`);

    // นับจำนวน cases จาก master และ offline
    const [masterCounts, offlineCounts] = await Promise.all([
      countCasesByDate(masterDb, 'Master DB', startDate, endDate),
      countCasesByDate(offlineDb, 'Offline DB', startDate, endDate)
    ]);

    // สร้าง map สำหรับเปรียบเทียบ
    const masterMap = new Map(masterCounts.map(item => [dayjs(item.accdate).format('DD/MM/YYYY'), parseInt(item.count)]));
    const offlineMap = new Map(offlineCounts.map(item => [dayjs(item.accdate).format('DD/MM/YYYY'), parseInt(item.count)]));
    // สร้างรายการวันที่ทั้งหมด 7 วัน
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(dayjs().subtract(i, 'day').format('DD/MM/YYYY'));
    }

    // สร้างข้อความรายงาน
    let message = `📊 <b>DB Balance Report</b>\n`;
    message += `📅 Accident Date: ${startDate} to ${endDate}\n\n`;
    message += `⏰ Report: ${dayjs().format('DD/MM/YYYY HH:mm:ss')}\n\n`;
    message += `<pre>`;
    message += `AccDate    | Master  | Offline | Diff\n`;
    message += `-----------|---------|---------|----------\n`;

    let totalMaster = 0;
    let totalOffline = 0;
    let hasIssue = false;

    dates.forEach(date => {
      const masterCount = masterMap.get(date) || 0;
      const offlineCount = offlineMap.get(date) || 0;
      const diff = masterCount - offlineCount;

      totalMaster += masterCount;
      totalOffline += offlineCount;

      // ตรวจสอบว่ามีความแตกต่างหรือไม่
      if (Math.abs(diff) > 0) {
        hasIssue = true;
      }

      const diffStr = diff === 0 ? '✓' : (diff > 0 ? `+${diff}` : `${diff}`);
      message += `${date} | ${String(masterCount).padStart(7)} | ${String(offlineCount).padStart(7)} | ${diffStr}\n`;
    });

    message += `-----------|---------|---------|----------\n`;
    message += `Total      | ${String(totalMaster).padStart(7)} | ${String(totalOffline).padStart(7)} | ${totalMaster - totalOffline}\n`;
    message += `</pre>\n`;

    // เพิ่มสถานะ
    if (hasIssue) {
      message += `\n⚠️ <b>Status:</b> Differences detected`;
    } else {
      message += `\n✅ <b>Status:</b> All in sync`;
    }

    // แสดงใน console
    console.log('\n' + message.replace(/<\/?[^>]+(>|$)/g, ''));

    // ส่งไป Telegram
    await sendTelegramNotification(message);

    const endTime = dayjs();
    const duration = endTime.diff(startTime, 'second', true);
    console.log(`[${endTime.format('YYYY-MM-DD HH:mm:ss')}] Balance check completed in ${duration.toFixed(2)}s\n`);

    return {
      success: true,
      totalMaster,
      totalOffline,
      hasIssue
    };
  } catch (error) {
    console.error('Error in balance check:', error);

    // ส่ง error notification
    const errorMessage = `❌ <b>DB Balance Check Failed</b>\n\n` +
      `⏰ ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n` +
      `Error: ${error.message}`;

    await sendTelegramNotification(errorMessage);

    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  checkBalance
};
