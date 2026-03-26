const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'absensi_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initDB() {
    const connection = await pool.getConnection();
    await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nama_lengkap VARCHAR(255) NOT NULL,
            nama_panggilan VARCHAR(100) NOT NULL,
            role ENUM('siswa', 'guru') NOT NULL,
            status VARCHAR(100) NOT NULL,
            nis VARCHAR(50) DEFAULT NULL,
            nisn VARCHAR(50) DEFAULT NULL,
            kelas VARCHAR(50) DEFAULT NULL,
            tempat_tanggal_lahir VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS absensi (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            tanggal DATE NOT NULL,
            status ENUM('hadir') DEFAULT 'hadir',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_absensi (user_id, tanggal),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS devices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            device_id VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    connection.release();
    console.log('Database initialized');
}
initDB();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const device_id = crypto.randomBytes(32).toString('hex');
        await pool.query('INSERT INTO devices (device_id) VALUES (?)', [device_id]);
        res.json({ success: true, device_id, role: 'admin' });
    } else {
        res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
});

app.post('/api/logout', async (req, res) => {
    const { device_id } = req.body;
    await pool.query('DELETE FROM devices WHERE device_id = ?', [device_id]);
    res.json({ success: true });
});

app.get('/api/check-device', async (req, res) => {
    const { device_id } = req.query;
    if (!device_id) return res.json({ role: 'user' });
    const [rows] = await pool.query('SELECT * FROM devices WHERE device_id = ?', [device_id]);
    if (rows.length > 0) {
        res.json({ role: 'admin', device_id });
    } else {
        res.json({ role: 'user' });
    }
});

app.post('/api/users', async (req, res) => {
    const { nama_lengkap, nama_panggilan, role, status, nis, nisn, kelas, tempat_tanggal_lahir } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO users (nama_lengkap, nama_panggilan, role, status, nis, nisn, kelas, tempat_tanggal_lahir)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [nama_lengkap, nama_panggilan, role, status, nis || null, nisn || null, kelas || null, tempat_tanggal_lahir]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/users', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY id DESC');
    res.json(rows);
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
});

app.post('/api/absen', async (req, res) => {
    const { user_id, device_id } = req.body;
    const [deviceRows] = await pool.query('SELECT * FROM devices WHERE device_id = ?', [device_id]);
    if (deviceRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const today = new Date().toISOString().slice(0,10);
    try {
        await pool.query(
            `INSERT INTO absensi (user_id, tanggal) VALUES (?, ?)`,
            [user_id, today]
        );
        res.json({ success: true });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Sudah absen hari ini' });
        } else {
            res.status(500).json({ success: false, message: error.message });
        }
    }
});

app.get('/api/absen', async (req, res) => {
    const { date } = req.query;
    const tanggal = date || new Date().toISOString().slice(0,10);
    const [rows] = await pool.query(
        `SELECT u.*, a.tanggal as absen_tanggal 
         FROM users u 
         LEFT JOIN absensi a ON u.id = a.user_id AND a.tanggal = ? 
         ORDER BY u.id DESC`,
        [tanggal]
    );
    res.json(rows);
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Akses di: http://localhost:${port}`);
});