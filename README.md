# PHER DB Balance - Master to Offline Database Sync

โปรเจค Node.js Cron Job สำหรับ sync ข้อมูลจาก Master Database ไปยัง Offline Server อัตโนมัติทุก 2 นาที โดยใช้ Knex และ MySQL2

## Features

- ✅ Sync ข้อมูลอัตโนมัติทุก 2 นาที
- ✅ รองรับหลายตารางพร้อมกัน
- ✅ รองรับ Filters และ Options
- ✅ แสดง Log รายละเอียดการทำงาน
- ✅ Health Check Endpoint (GET /)

## ติดตั้ง Dependencies

```bash
npm install
```

## ตั้งค่า Environment Variables

แก้ไขไฟล์ `.env` ให้ตรงกับข้อมูล Database ของคุณ:

```env
PORT=3000

# Master Database
MASTER_DB_HOST=localhost
MASTER_DB_PORT=3306
MASTER_DB_USER=root
MASTER_DB_PASSWORD=yourpassword
MASTER_DB_NAME=master_db

# Offline Database
OFFLINE_DB_HOST=localhost
OFFLINE_DB_PORT=3306
OFFLINE_DB_USER=root
OFFLINE_DB_PASSWORD=yourpassword
OFFLINE_DB_NAME=offline_db
```

## กำหนดค่าการ Sync

แก้ไขไฟล์ `src/jobs/syncJob.js` เพื่อกำหนดตารางที่ต้องการ sync:

```javascript
const SYNC_CONFIG = [
  {
    table: 'users',
    filters: { status: 'active' },
    options: { truncate: false }
  },
  {
    table: 'orders',
    filters: { created_at: '2026-01-01' },
    options: { truncate: false }
  },
  // เพิ่มตารางอื่น ๆ ได้ที่นี่
];
```

## เริ่มใช้งาน

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Cron Job จะทำงานอัตโนมัติทุก 1 นาที และแสดง Log ในคอนโซล

## Health Check

ตรวจสอบสถานะการทำงานของระบบ:

```bash
curl http://localhost:3000/
```

**Response:**
```json
{
  "status": "running",
  "message": "DB Sync Cron Job is active",
  "timestamp": "2026-01-03T10:00:00.000Z"
}

## Project Structure

```
db_balance2/
├── src/
│   ├── config/
│   │   ├── database.js       # Database connections
│   │   └── knexfile.js       # Knex configuration
│   ├── services/
│   │   └── syncService.js    # Business logic
│   ├── routes/
│   │   └── syncRoutes.js     # API routes
│   └── index.js              # Main application
├── .env                       # Environment variables
├── .env.example              # Environment template
├── package.json
└── README.md
```

## ตัวอย่างการใช้งาน

### 1. อ่านข้อมูล Users ทั้งหมดจาก Master
```javascript
fetch('http://localhost:3000/api/sync/read/users')
  .then(res => res.json())
  .then(data => console.log(data));
```

### 2. Sync ข้อมูล Users ที่ active ไป Offline
```javascript
fetch('http://localhost:3000/api/sync/sync/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filters: { status: 'active' },
    options: { truncate: false }
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

### 3. เปรียบเทียบข้อมูล
```javascript
fetch('http://localhost:3000/api/sync/compare/users')
  .then(res => res.json())
  .then(data => console.log(dataSync business logic
│   ├── jobs/
│   │   └── syncJob.js        # Cron job configuration
│   └── index.js              # Main application
├── .env                       # Environment variables
├── .env.example              # Environment template
├── package.json
└── README.md
```

## ตัวอย่าง Log Output

```
🚀 Starting DB Sync Cron Job...
✓ Master database connected successfully
✓ Offline database connected successfully
⏰ Cron job scheduled: Every 1 minute
✓ System is running. Press Ctrl+C to stop.

⏰ Running scheduled sync...
[2026-01-03T10:00:00.000Z] Starting scheduled sync...
  → Syncing table: users
  ✓ users: 150 records synced
[2026-01-03T10:00:02.345Z] Sync completed in 2.345s
  Total tables: 1
  Successful: 1
  Failed: 0