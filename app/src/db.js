import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('[db] DATABASE_URL is not set. Set it in .env');
}

export const pool = mysql.createPool(databaseUrl || {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'password',
  database: process.env.MYSQL_DATABASE || 'restaurant_map',
  port: Number(process.env.MYSQL_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function ensureSchema() {
  const createRestaurants = `
    CREATE TABLE IF NOT EXISTS restaurants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      latitude DOUBLE NOT NULL,
      longitude DOUBLE NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

  const createPhotos = `
    CREATE TABLE IF NOT EXISTS restaurant_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      restaurant_id INT NOT NULL,
      photo_url VARCHAR(512) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_restaurant_photos_restaurant_id FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

  const createIndex = `
    CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants (name);
  `;

  const conn = await pool.getConnection();
  try {
    await conn.execute(createRestaurants);
    await conn.execute(createPhotos);
    // MySQL before 8.0.13 doesn't support IF NOT EXISTS for indexes. Try-catch.
    try {
      await conn.execute(createIndex);
    } catch (e) {
      if (!String(e.message || '').includes('Duplicate key name')) {
        console.warn('[db] Creating index failed (possibly already exists):', e.message);
      }
    }
  } finally {
    conn.release();
  }
}