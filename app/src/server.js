import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import crypto from 'crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { pool, ensureSchema } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const csrfCookieName = process.env.CSRF_COOKIE_NAME || 'csrfToken';

app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

function getOrSetCsrfToken(req, res) {
  let token = req.cookies[csrfCookieName];
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    res.cookie(csrfCookieName, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: appBaseUrl.startsWith('https://'),
      maxAge: 1000 * 60 * 60 * 24 * 30,
      path: '/',
    });
  }
  return token;
}

function verifyCsrf(req, res, next) {
  const cookieToken = req.cookies[csrfCookieName];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

const allowedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const maxFileSizeBytes = 8 * 1024 * 1024; // 8MB per file

function sanitizeFileName(name) {
  const trimmed = (name || 'file').trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9._-]/g, '_');
}

function validateLatLng(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return false;
  if (latNum < -90 || latNum > 90) return false;
  if (lngNum < -180 || lngNum > 180) return false;
  return true;
}

const s3Region = process.env.AWS_REGION;
const s3Bucket = process.env.AWS_S3_BUCKET;
const s3Endpoint = process.env.AWS_S3_ENDPOINT;

let s3Client = null;
if (s3Region && s3Bucket) {
  s3Client = new S3Client({
    region: s3Region,
    forcePathStyle: Boolean(s3Endpoint),
    endpoint: s3Endpoint || undefined,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  });
}

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/csrf', (req, res) => {
  const token = getOrSetCsrfToken(req, res);
  res.json({ token });
});

app.get('/api/config', (req, res) => {
  const token = getOrSetCsrfToken(req, res);
  res.json({
    csrfToken: token,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    appBaseUrl,
    maxFileSizeBytes,
    allowedImageTypes: Array.from(allowedImageTypes),
  });
});

app.post('/api/s3/presign', verifyCsrf, async (req, res) => {
  if (!s3Client || !s3Bucket || !s3Region) {
    return res.status(500).json({ error: 'S3 is not configured on the server' });
  }
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  if (!files.length) return res.status(400).json({ error: 'files is required' });

  const now = Date.now();
  const basePrefix = `restaurants/${now}-${crypto.randomBytes(8).toString('hex')}`;

  try {
    const results = await Promise.all(files.map(async (file) => {
      const { fileName, contentType, sizeBytes } = file || {};
      if (!fileName || !contentType || typeof sizeBytes !== 'number') {
        throw new Error('Invalid file descriptor');
      }
      if (!allowedImageTypes.has(contentType)) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }
      if (sizeBytes > maxFileSizeBytes) {
        throw new Error(`File too large: ${sizeBytes} > ${maxFileSizeBytes}`);
      }
      const safeName = sanitizeFileName(fileName);
      const key = `${basePrefix}/${safeName}`;

      const conditions = [
        ['content-length-range', 0, maxFileSizeBytes],
        { 'Content-Type': contentType },
        { bucket: s3Bucket },
        ['starts-with', '$key', basePrefix + '/'],
      ];

      const presigned = await createPresignedPost(s3Client, {
        Bucket: s3Bucket,
        Key: key,
        Conditions: conditions,
        Fields: { 'Content-Type': contentType },
        Expires: 60 * 5,
      });

      const finalUrl = s3Endpoint
        ? `${s3Endpoint.replace(/\/$/, '')}/${s3Bucket}/${key}`
        : `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;

      return { fileName: safeName, key, url: presigned.url, fields: presigned.fields, finalUrl };
    }));

    res.json({ uploads: results });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/restaurants', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  try {
    let rows;
    if (q) {
      const like = `%${q}%`;
      [rows] = await pool.query(
        'SELECT id, name, latitude, longitude FROM restaurants WHERE name LIKE ? ORDER BY id DESC LIMIT 500',
        [like]
      );
    } else {
      [rows] = await pool.query(
        'SELECT id, name, latitude, longitude FROM restaurants ORDER BY id DESC LIMIT 1000'
      );
    }
    res.json({ restaurants: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/restaurants/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [[restaurant]] = await pool.query('SELECT * FROM restaurants WHERE id = ?', [id]);
    if (!restaurant) return res.status(404).json({ error: 'Not found' });
    const [photos] = await pool.query(
      'SELECT id, photo_url AS photoUrl, uploaded_at AS uploadedAt FROM restaurant_photos WHERE restaurant_id = ? ORDER BY uploaded_at ASC',
      [id]
    );
    res.json({ restaurant: { ...restaurant, photos } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/restaurants', verifyCsrf, async (req, res) => {
  const { name, latitude, longitude, comment, photoUrls } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
  if (!validateLatLng(latitude, longitude)) return res.status(400).json({ error: 'Invalid lat/lng' });
  const safeName = name.trim().slice(0, 255);
  const safeComment = (typeof comment === 'string' ? comment : '').slice(0, 5000);
  const photos = Array.isArray(photoUrls) ? photoUrls : [];
  if (photos.some((u) => typeof u !== 'string' || !u.startsWith('http'))) {
    return res.status(400).json({ error: 'Invalid photoUrls' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      'INSERT INTO restaurants (name, latitude, longitude, comment) VALUES (?, ?, ?, ?)',
      [safeName, Number(latitude), Number(longitude), safeComment]
    );
    const restaurantId = result.insertId;
    for (const url of photos) {
      await conn.execute(
        'INSERT INTO restaurant_photos (restaurant_id, photo_url) VALUES (?, ?)',
        [restaurantId, url]
      );
    }
    await conn.commit();
    res.status(201).json({ id: restaurantId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

app.delete('/api/restaurants/:id', verifyCsrf, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [result] = await pool.execute('DELETE FROM restaurants WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static('public', { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

(async () => {
  try {
    if (process.env.SKIP_DB_INIT === '1') {
      console.warn('[startup] SKIP_DB_INIT=1: skipping schema creation');
    } else {
      await ensureSchema();
    }
    app.listen(port, () => {
      console.log(`Server running on ${appBaseUrl}`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
})();