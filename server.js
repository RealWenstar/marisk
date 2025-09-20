const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/*
 * Simple Node.js server for the Marisk beta website.
 *
 * This server serves static files from the `public` directory and exposes
 * several API endpoints for translations, FAQs, gallery data, chat responses
 * and basic admin functionality. It uses only built‑in Node modules to
 * maximise portability and avoid external dependencies.
 */

const publicDir = path.join(__dirname, 'public');
const dataDir = path.join(__dirname, 'data');

// In‑memory caches for frequently accessed data. These are populated
// synchronously on startup and updated when admin endpoints modify them.
let faqs = [];
let gallery = [];
const localesCache = {};
const sessions = {};

function loadData() {
  try {
    const faqsPath = path.join(dataDir, 'faqs.json');
    faqs = JSON.parse(fs.readFileSync(faqsPath, 'utf8'));
  } catch (err) {
    console.error('Error loading FAQs:', err);
    faqs = [];
  }
  try {
    const galleryPath = path.join(dataDir, 'gallery.json');
    gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf8'));
  } catch (err) {
    console.error('Error loading gallery:', err);
    gallery = [];
  }
}

// Load initial data at startup
loadData();

/**
 * Helper: send a JSON response with CORS headers.
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {object} obj
 */
function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(obj));
}

/**
 * Helper: serve static files from the public directory. If the requested
 * path resolves to a directory, serve index.html within that directory.
 * Returns true if the file was found and served, false otherwise.
 * @param {string} pathname
 * @param {http.ServerResponse} res
 */
function serveStatic(pathname, res) {
  let filePath = path.join(publicDir, pathname);
  try {
    // Prevent path traversal
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(publicDir)) {
      return false;
    }
    // If the path is a directory, append index.html
    const stats = fs.existsSync(resolved) && fs.statSync(resolved);
    if (stats && stats.isDirectory()) {
      filePath = path.join(resolved, 'index.html');
    } else {
      filePath = resolved;
    }
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.ico': 'image/x-icon'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const fileContents = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType
    });
    res.end(fileContents);
    return true;
  } catch (err) {
    console.error('Static serve error:', err);
    return false;
  }
}

/**
 * Parse the JSON body of a request. Returns an object or an empty object
 * on parse error.
 * @param {http.IncomingMessage} req
 */
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // limit body size to 20MB to avoid exhaustion
      if (body.length > 20 * 1024 * 1024) {
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      try {
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          resolve(JSON.parse(body || '{}'));
        } else {
          resolve({});
        }
      } catch (err) {
        console.error('JSON parse error', err);
        resolve({});
      }
    });
  });
}

/**
 * Retrieve a translation object for a given language. Uses cache to avoid
 * reading the file repeatedly. If the requested language does not exist,
 * falls back to English.
 * @param {string} lang
 */
function getLocale(lang) {
  return new Promise((resolve) => {
    if (localesCache[lang]) {
      return resolve(localesCache[lang]);
    }
    const localePath = path.join(dataDir, 'locales', `${lang}.json`);
    fs.readFile(localePath, 'utf8', (err, data) => {
      if (err) {
        // Fallback to English
        if (lang !== 'en') {
          return resolve(getLocale('en'));
        }
        return resolve({});
      }
      try {
        const obj = JSON.parse(data);
        localesCache[lang] = obj;
        resolve(obj);
      } catch (e) {
        resolve({});
      }
    });
  });
}

/**
 * Authenticate an admin request. Expects an Authorization header with
 * "Bearer <token>". Returns true if token is valid and not expired.
 * Sessions are stored in memory with a timestamp. Tokens expire after 24h.
 * @param {http.IncomingMessage} req
 */
function isAuthenticated(req) {
  const auth = req.headers['authorization'];
  if (!auth) return false;
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false;
  const token = parts[1];
  const session = sessions[token];
  if (!session) return false;
  // expire after 24 hours
  const now = Date.now();
  if (now - session.timestamp > 24 * 60 * 60 * 1000) {
    delete sessions[token];
    return false;
  }
  // refresh timestamp
  session.timestamp = now;
  return true;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  try {
    const { method } = req;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Preflight for CORS
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      });
      return res.end();
    }

    // API: translations
    if (method === 'GET' && pathname.startsWith('/api/locales/')) {
      const lang = pathname.replace('/api/locales/', '').replace('.json', '');
      const localeObj = await getLocale(lang);
      return sendJson(res, 200, localeObj);
    }
    // API: FAQs list
    if (method === 'GET' && pathname === '/api/faqs') {
      return sendJson(res, 200, faqs);
    }
    // API: Gallery list
    if (method === 'GET' && pathname === '/api/gallery') {
      return sendJson(res, 200, gallery);
    }
    // API: suggestions (returns 5 random question strings)
    if (method === 'GET' && pathname === '/api/faqs-suggestions') {
      const count = Math.min(5, faqs.length);
      const indices = new Set();
      while (indices.size < count) {
        indices.add(Math.floor(Math.random() * faqs.length));
      }
      const suggestions = Array.from(indices).map(i => faqs[i].question);
      return sendJson(res, 200, suggestions);
    }
    // API: chat
    if (method === 'POST' && pathname === '/api/chat') {
      const body = await parseBody(req);
      const question = (body.question || '').trim();
      const lang = (body.lang || 'en').trim();
      let answer = null;
      if (question) {
        const lower = question.toLowerCase();
        // Try exact match first
        const match = faqs.find(faq => faq.question.toLowerCase() === lower);
        if (match) {
          answer = match.answer;
        } else {
          // Try to find containing question (simple search)
          const partial = faqs.find(faq => lower.includes(faq.question.toLowerCase()) || faq.question.toLowerCase().includes(lower));
          if (partial) {
            answer = partial.answer;
          }
        }
      }
      if (!answer) {
        const localeObj = await getLocale(lang);
        answer = localeObj['chat_no_answer'] || 'Sorry, I don\'t know the answer.';
      }
      return sendJson(res, 200, { answer });
    }
    // API: admin login
    if (method === 'POST' && pathname === '/api/admin/login') {
      const body = await parseBody(req);
      const { username, password } = body;
      // Simple credential check; in production this should come from env/config
      if (username === 'admin' && password === 'admin') {
        const token = crypto.randomBytes(16).toString('hex');
        sessions[token] = { timestamp: Date.now() };
        return sendJson(res, 200, { token });
      }
      return sendJson(res, 401, { error: 'Invalid credentials' });
    }
    // API: add FAQ (admin)
    if (method === 'POST' && pathname === '/api/admin/add-faq') {
      if (!isAuthenticated(req)) {
        return sendJson(res, 403, { error: 'Unauthorized' });
      }
      const body = await parseBody(req);
      const { question, answer } = body;
      if (typeof question === 'string' && typeof answer === 'string' && question.trim() && answer.trim()) {
        faqs.push({ question: question.trim(), answer: answer.trim() });
        // persist to file
        try {
          fs.writeFileSync(path.join(dataDir, 'faqs.json'), JSON.stringify(faqs, null, 2));
        } catch (e) {
          console.error('Failed to write FAQs file', e);
        }
        return sendJson(res, 200, { success: true });
      }
      return sendJson(res, 400, { error: 'Invalid payload' });
    }
    // API: upload image pair (admin)
    if (method === 'POST' && pathname === '/api/admin/upload-image') {
      if (!isAuthenticated(req)) {
        return sendJson(res, 403, { error: 'Unauthorized' });
      }
      const body = await parseBody(req);
      const { before, after, title, description } = body;
      if (!before || !after) {
        return sendJson(res, 400, { error: 'Missing images' });
      }
      try {
        const saveImage = (dataUri, prefix) => {
          const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUri);
          if (!match) return null;
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
          const outputPath = path.join(publicDir, 'assets', 'img', filename);
          fs.writeFileSync(outputPath, buffer);
          return `assets/img/${filename}`;
        };
        const beforePath = saveImage(before, 'before');
        const afterPath = saveImage(after, 'after');
        if (!beforePath || !afterPath) {
          return sendJson(res, 400, { error: 'Invalid image data' });
        }
        const newEntry = { before: beforePath, after: afterPath, title: title || '', description: description || '' };
        gallery.push(newEntry);
        fs.writeFileSync(path.join(dataDir, 'gallery.json'), JSON.stringify(gallery, null, 2));
        return sendJson(res, 200, { success: true, entry: newEntry });
      } catch (e) {
        console.error('Failed to save images:', e);
        return sendJson(res, 500, { error: 'Failed to save images' });
      }
    }

    // If request starts with /admin, serve admin.html
    if (method === 'GET' && pathname === '/admin') {
      const adminPath = path.join(publicDir, 'admin.html');
      if (fs.existsSync(adminPath)) {
        const html = fs.readFileSync(adminPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(html);
      }
    }

    // Serve static files
    if (serveStatic(pathname, res)) {
      return;
    }
    // 404 not found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});