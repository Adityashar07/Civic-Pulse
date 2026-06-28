const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Determine database dialect based on env variable
const databaseUrl = process.env.DATABASE_URL;
const isPostgres = databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'));

let sqliteDb = null;
let pgPool = null;

if (isPostgres) {
  console.log('Database Mode: PostgreSQL (Cloud SQL)');
  pgPool = new Pool({
    connectionString: databaseUrl,
    // Turn on SSL for secure connection in production, unless disabled
    ssl: process.env.DB_DISABLE_SSL === 'true' ? false : { rejectUnauthorized: false }
  });
} else {
  console.log('Database Mode: SQLite (Local)');
  const DB_PATH = path.join(__dirname, 'database.sqlite');
  sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log('Connected to the SQLite database.');
    }
  });
}

// SQL Translator: Converts SQLite '?' placeholders to PostgreSQL '$1', '$2' etc.
function translateSql(sql) {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// Helper: Run SQL statements (INSERT, UPDATE, DELETE)
async function dbRun(sql, params = []) {
  if (isPostgres) {
    let translatedSql = translateSql(sql);
    const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
    
    if (isInsert && !translatedSql.toUpperCase().includes('RETURNING')) {
      translatedSql += ' RETURNING id';
    }
    
    const result = await pgPool.query(translatedSql, params);
    
    return {
      lastID: isInsert && result.rows[0] ? result.rows[0].id : null,
      changes: result.rowCount
    };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}

// Helper: Fetch all matching rows
async function dbAll(sql, params = []) {
  if (isPostgres) {
    const translatedSql = translateSql(sql);
    const result = await pgPool.query(translatedSql, params);
    return result.rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

// Helper: Fetch a single row
async function dbGet(sql, params = []) {
  if (isPostgres) {
    const translatedSql = translateSql(sql);
    const result = await pgPool.query(translatedSql, params);
    return result.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }
}

// Initialize Database Schemas
async function initDatabase() {
  if (isPostgres) {
    // 1. Create Users Table (PostgreSQL)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        reputation_points INTEGER DEFAULT 0,
        role VARCHAR(20) CHECK(role IN ('citizen', 'moderator', 'official')) DEFAULT 'citizen',
        badges TEXT DEFAULT '[]'
      )
    `);

    // 2. Create Issues Table (PostgreSQL)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS issues (
        id SERIAL PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(30) CHECK(category IN ('pothole', 'water_leak', 'streetlight', 'waste_management', 'infrastructure', 'other')) NOT NULL,
        status VARCHAR(20) CHECK(status IN ('reported', 'verified', 'in_progress', 'resolved', 'duplicate')) DEFAULT 'reported',
        severity VARCHAR(15) CHECK(severity IN ('low', 'medium', 'high')) DEFAULT 'low',
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        address TEXT,
        image_url TEXT,
        reporter_id INTEGER,
        upvotes INTEGER DEFAULT 0,
        created_at VARCHAR(40) NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        FOREIGN KEY (reporter_id) REFERENCES users(id)
      )
    `);

    // 3. Create Comments Table (PostgreSQL)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        issue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

  } else {
    // 1. Create Users Table (SQLite)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        reputation_points INTEGER DEFAULT 0,
        role TEXT CHECK(role IN ('citizen', 'moderator', 'official')) DEFAULT 'citizen',
        badges TEXT DEFAULT '[]'
      )
    `);

    // 2. Create Issues Table (SQLite)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT CHECK(category IN ('pothole', 'water_leak', 'streetlight', 'waste_management', 'infrastructure', 'other')) NOT NULL,
        status TEXT CHECK(status IN ('reported', 'verified', 'in_progress', 'resolved', 'duplicate')) DEFAULT 'reported',
        severity TEXT CHECK(severity IN ('low', 'medium', 'high')) DEFAULT 'low',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT,
        image_url TEXT,
        reporter_id INTEGER,
        upvotes INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (reporter_id) REFERENCES users(id)
      )
    `);

    // 3. Create Comments Table (SQLite)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  }

  // Insert default seed users if table is empty
  const usersCount = await dbGet('SELECT COUNT(*) as count FROM users');
  if (parseInt(usersCount.count) === 0) {
    await dbRun(`
      INSERT INTO users (username, reputation_points, role, badges)
      VALUES 
        ('Aria_Green', 340, 'citizen', '["First Responder", "Local Guardian"]'),
        ('John_Doe', 120, 'citizen', '["Active Citizen"]'),
        ('City_Admin_Mark', 0, 'official', '["City Engineer"]'),
        ('Moderator_Jane', 500, 'moderator', '["Community Mod"]')
    `);
    console.log('Seed users inserted.');
  }
}

module.exports = {
  dbRun,
  dbAll,
  dbGet,
  initDatabase,
  isPostgres
};
