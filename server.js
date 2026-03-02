// ============================================================
//  Ennovyx Node.js Server
// ============================================================

const fs = require('fs');
const pathModule = require('path');
const envPath = pathModule.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8')
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
        .forEach(line => {
            const t = line.trim();
            if (!t || t.startsWith('#')) return;
            const eq = t.indexOf('=');
            if (eq < 1) return;
            const k = t.slice(0, eq).trim();
            const v = t.slice(eq + 1).trim();
            if (k && !process.env[k]) process.env[k] = v;
        });
    console.log('✅ .env loaded. GROQ key:', !!process.env.GROQ_API_KEY, '| Email:', process.env.EMAIL_USER || 'not set');
} else {
    console.warn('⚠️  No .env file found!');
}

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const nodemailer = require('nodemailer');
const multer     = require('multer');

// ── File upload setup ─────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'university', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
        const allowed = /\.(mp4|mov|webm|mkv|avi|pdf|jpg|jpeg|png|gif|webp)$/i;
        cb(null, allowed.test(file.originalname));
    }
});

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));
app.use('/signup',    express.static(path.join(__dirname, 'signup')));
app.use('/templates', express.static(path.join(__dirname, 'templates')));

// ============================================================
//  AI RATE LIMITING — 15 credits per user per 24 hours
//  Persisted to usage.json so resets survive server restarts
// ============================================================
const AI_DAILY_LIMIT = 15;
const USAGE_FILE = path.join(__dirname, 'usage.json');

function loadUsageStore() {
    try {
        if (fs.existsSync(USAGE_FILE)) return JSON.parse(fs.readFileSync(USAGE_FILE,'utf8'));
    } catch(e) {}
    return {};
}

function saveUsageStore(store) {
    try { fs.writeFileSync(USAGE_FILE, JSON.stringify(store), 'utf8'); } catch(e) {}
}

// Prune old entries (keep only today's) every hour
function pruneUsageStore() {
    const today = new Date().toISOString().split('T')[0];
    const store = loadUsageStore();
    let changed = false;
    for (const key of Object.keys(store)) {
        if (!key.endsWith('_' + today)) { delete store[key]; changed = true; }
    }
    if (changed) saveUsageStore(store);
}
setInterval(pruneUsageStore, 3600000);

function getUsageKey(uid) {
    const today = new Date().toISOString().split('T')[0];
    return `${uid}_${today}`;
}

function getUserUsage(uid) {
    const store = loadUsageStore();
    return store[getUsageKey(uid)] || 0;
}

function incrementUsage(uid) {
    const store = loadUsageStore();
    const key = getUsageKey(uid);
    store[key] = (store[key] || 0) + 1;
    saveUsageStore(store);
    return store[key];
}

// ── Groq AI Endpoint ──────────────────────────────────────────
app.post('/api/ai/research', async (req, res) => {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY not configured.' });
    }

    const { messages, userId } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'No messages provided.' });
    }

    // Rate limit check
    const uid = userId || req.ip;
    const currentUsage = getUserUsage(uid);
    if (currentUsage >= AI_DAILY_LIMIT) {
        return res.status(429).json({
            error: `Daily limit reached (${AI_DAILY_LIMIT} questions/day). Resets at midnight.`,
            limitReached: true,
            used: currentUsage,
            limit: AI_DAILY_LIMIT
        });
    }

    const fullMessages = [
        {
            role: 'system',
            content: `You are an AI Research Assistant built into Ennovyx, a productivity app for students.
Help students research topics for their documents and assignments.
Be clear, accurate and educational. Use simple language.
Format with **bold** for key terms. Use bullet points where helpful.
Keep responses focused (150-300 words usually).`
        },
        ...messages
    ];

    try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: fullMessages,
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!groqResponse.ok) {
            const errData = await groqResponse.json().catch(() => ({}));
            if (groqResponse.status === 429) {
                return res.status(429).json({ error: 'AI service busy. Wait a moment.' });
            }
            throw new Error(errData.error?.message || `Groq error ${groqResponse.status}`);
        }

        const data = await groqResponse.json();
        const answer = data.choices?.[0]?.message?.content || 'No response.';

        // Increment usage after successful response
        const newCount = incrementUsage(uid);

        return res.json({
            answer,
            used: newCount,
            limit: AI_DAILY_LIMIT,
            remaining: AI_DAILY_LIMIT - newCount
        });

    } catch (err) {
        console.error('Groq error:', err.message);
        return res.status(500).json({ error: 'AI request failed: ' + err.message });
    }
});

// ── Get AI usage for a user ───────────────────────────────────
app.get('/api/ai/usage', (req, res) => {
    const uid = req.query.userId || req.ip;
    const used = getUserUsage(uid);
    return res.json({ used, limit: AI_DAILY_LIMIT, remaining: AI_DAILY_LIMIT - used });
});

// ============================================================
//  EMAIL — Nodemailer (no EmailJS, works with frontend closed)
// ============================================================
function createTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS  // Gmail App Password
        }
    });
}

function buildEmailHTML(data) {
    const { userName, date, tasks, events, documents, notes } = data;
    const taskRows = tasks.length
        ? tasks.map(t => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f8;">${t.title}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f8;color:#8888a8;font-size:12px;">${t.subjectName || '—'}</td></tr>`).join('')
        : `<tr><td colspan="2" style="padding:12px;color:#a0a0b8;font-size:13px;">No tasks due today 🎉</td></tr>`;

    const eventRows = events.length
        ? events.map(e => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f8;">${e.title}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f8;color:#8888a8;font-size:12px;">${e.time || '—'}</td></tr>`).join('')
        : `<tr><td colspan="2" style="padding:12px;color:#a0a0b8;font-size:13px;">No events today</td></tr>`;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f8fc;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">

  <div style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(99,102,241,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;">
      <div style="font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.7);font-weight:600;margin-bottom:6px;">ENNOVYX</div>
      <div style="font-size:22px;font-weight:700;color:white;">Good morning, ${userName}! ☀️</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">${date}</div>
    </div>

    <!-- Stats row -->
    <div style="display:flex;padding:20px 32px;gap:12px;background:#fafafa;border-bottom:1px solid #f0f0f8;">
      <div style="flex:1;text-align:center;padding:12px;background:white;border-radius:12px;border:1px solid #f0f0f8;">
        <div style="font-size:24px;font-weight:700;color:#4f46e5;">${tasks.length}</div>
        <div style="font-size:11px;color:#a0a0b8;margin-top:2px;">TASKS TODAY</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:white;border-radius:12px;border:1px solid #f0f0f8;">
        <div style="font-size:24px;font-weight:700;color:#7c3aed;">${events.length}</div>
        <div style="font-size:11px;color:#a0a0b8;margin-top:2px;">EVENTS</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:white;border-radius:12px;border:1px solid #f0f0f8;">
        <div style="font-size:24px;font-weight:700;color:#a855f7;">${documents.length}</div>
        <div style="font-size:11px;color:#a0a0b8;margin-top:2px;">DOCS</div>
      </div>
    </div>

    <!-- Tasks -->
    <div style="padding:24px 32px;">
      <div style="font-size:12px;font-weight:600;color:#a0a0b8;letter-spacing:1px;margin-bottom:12px;">📋 TODAY'S TASKS</div>
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:10px;overflow:hidden;">
        ${taskRows}
      </table>
    </div>

    <!-- Events -->
    <div style="padding:0 32px 24px;">
      <div style="font-size:12px;font-weight:600;color:#a0a0b8;letter-spacing:1px;margin-bottom:12px;">📅 TODAY'S EVENTS</div>
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:10px;overflow:hidden;">
        ${eventRows}
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f8f8fc;border-top:1px solid #f0f0f8;text-align:center;">
      <a href="https://ennovyx.com/dashboard" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">Open Dashboard →</a>
      <div style="margin-top:16px;font-size:11px;color:#c0c0d8;">Ennovyx · Daily Summary · <a href="#" style="color:#6366f1;">Manage preferences</a></div>
    </div>

  </div>
</div>
</body></html>`;
}

// Send immediate email (called from frontend "Test" button)
app.post('/api/email/send-summary', async (req, res) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(500).json({ error: 'Email not configured. Add EMAIL_USER and EMAIL_PASS to .env' });
    }
    const { to, userName, date, tasks, events, documents, notes } = req.body;
    if (!to) return res.status(400).json({ error: 'No recipient email provided.' });
    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"Ennovyx" <${process.env.EMAIL_USER}>`,
            to,
            subject: `Your Daily Summary — ${date || new Date().toDateString()}`,
            html: buildEmailHTML({ userName: userName || 'Student', date: date || new Date().toDateString(), tasks: tasks || [], events: events || [], documents: documents || [], notes: notes || [] })
        });
        console.log(`📧 Summary sent to ${to}`);
        return res.json({ success: true });
    } catch (err) {
        console.error('Email error:', err.message);
        return res.status(500).json({ error: 'Failed to send email: ' + err.message });
    }
});

// ============================================================
//  SERVER-SIDE SCHEDULER — fires at the user's saved time
//  Works even when browser is closed (polling Firestore)
// ============================================================
// We store a lightweight schedule table: { uid, email, time, lastSent }
const scheduleTable = {}; // { uid: { email, name, time, lastSent } }

// Frontend registers/updates schedule
app.post('/api/email/register-schedule', (req, res) => {
    const { uid, email, name, time, enabled } = req.body;
    if (!uid || !email || !time) return res.status(400).json({ error: 'uid, email, time required' });
    if (enabled === false) {
        delete scheduleTable[uid];
        console.log(`📧 Schedule removed for ${email}`);
    } else {
        scheduleTable[uid] = { email, name: name || 'Student', time, lastSent: scheduleTable[uid]?.lastSent || null };
        console.log(`📧 Schedule registered: ${email} at ${time}`);
    }
    return res.json({ success: true });
});

// Server-side scheduler runs every 60s
setInterval(async () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    const today = now.toISOString().split('T')[0];

    for (const [uid, schedule] of Object.entries(scheduleTable)) {
        const { email, name, time, lastSent } = schedule;
        if (time !== currentTime) continue;
        if (lastSent === today) continue;
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) continue;

        try {
            const transporter = createTransporter();
            await transporter.sendMail({
                from: `"Ennovyx" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: `Your Daily Summary — ${now.toDateString()}`,
                html: buildEmailHTML({
                    userName: name,
                    date: now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }),
                    tasks: [], events: [], documents: [], notes: []
                })
            });
            scheduleTable[uid].lastSent = today;
            console.log(`✅ Scheduled email sent to ${email} at ${currentTime}`);
        } catch (err) {
            console.error(`❌ Scheduled email failed for ${email}:`, err.message);
        }
    }
}, 60000);

// ============================================================
//  GEO PRICING — detect region from IP, return correct price
// ============================================================
const DEVELOPING_COUNTRIES = new Set([
  'PK','IN','BD','NG','EG','PH','VN','ID','GH','KE','TZ','UG','ET','MZ',
  'MW','ZM','ZW','SD','SS','ML','BF','NE','TD','CF','SO','MR','SN','GN',
  'SL','LR','CI','TG','BJ','RW','BI','DJ','KM','MG','MU','SC','AF','NP',
  'MM','KH','LA','YE','IQ','SY','LY','DZ','TN','MA'
]);

// ── PWA Static Files ──────────────────────────────────────
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(__dirname, 'manifest.json'));
});
app.get('/sw.js', (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'sw.js'));
});
app.use('/icons', express.static(path.join(__dirname, 'icons')));

app.get('/api/geo-price', (req, res) => {
  // Return the client's IP — geo lookup happens client-side to avoid server network deps
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.headers['x-real-ip']
             || req.socket.remoteAddress
             || '';
  const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.');
  res.json({ ip, isLocal });
});

// ============================================================
//  WELCOME EMAIL — sent on new user signup
// ============================================================
app.post('/api/email/welcome', async (req, res) => {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(200).json({ ok: true, skipped: 'Email not configured' });
    }
    try {
        const transporter = createTransporter();
        const displayName = name || email.split('@')[0];
        await transporter.sendMail({
            from: `"Ennovyx" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Welcome to Ennovyx, ${displayName}!`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f8;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:40px 40px 32px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:12px;justify-content:center;">
        <img src="https://ennovyx.com/dashboard/images/eu-logo-for-dark-theme.png" 
             alt="Ennovyx" height="44" style="height:44px;display:block;"
             onerror="this.style.display='none'">
      </div>
      <div style="font-size:36px;font-weight:800;color:#fff;letter-spacing:-1px;margin-top:12px;">Ennovyx</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.75);margin-top:4px;">Your Student Productivity Hub</div>
    </div>
    <!-- Body -->
    <div style="padding:40px;">
      <h1 style="font-size:22px;font-weight:700;color:#1e1e2e;margin:0 0 12px;">Welcome aboard, ${displayName}!</h1>
      <p style="font-size:15px;color:#6868a0;line-height:1.7;margin:0 0 28px;">
        Your Ennovyx account is ready. Here's everything you can do right now:
      </p>
      <!-- Features -->
      <div style="display:grid;gap:14px;margin-bottom:32px;">
        ${[
          ['📋','Tasks & Calendar','Plan your day, track deadlines, never miss a due date.'],
          ['📚','Subjects & Documents','Organize your notes, upload files, keep everything in one place.'],
          ['🤖','AI Research (e-brains)','Ask anything about your studies — get instant, intelligent answers.'],
          ['📊','Discipline Tracker','Build habits, track progress, stay consistent.'],
          ['💰','Expense Tracker','Monitor your spending as a student.'],
        ].map(([icon,title,desc]) => `
          <div style="display:flex;gap:14px;align-items:flex-start;padding:16px;background:#f8f8ff;border-radius:12px;border:1px solid #e8e8f8;">
            <span style="font-size:22px;flex-shrink:0">${icon}</span>
            <div>
              <div style="font-size:14px;font-weight:600;color:#1e1e2e;margin-bottom:2px;">${title}</div>
              <div style="font-size:13px;color:#8888a8;">${desc}</div>
            </div>
          </div>`).join('')}
      </div>
      <a href="https://ennovyx.com/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;margin-bottom:24px;">
        Open Dashboard →
      </a>
      <p style="font-size:12px;color:#a0a0b8;text-align:center;margin:0;">
        Questions? Reply to this email anytime.<br>
        <a href="https://ennovyx.com/university" style="color:#6366f1;">Ennovyx University</a> · 
        <a href="https://ennovyx.com/dashboard" style="color:#6366f1;">Dashboard</a>
      </p>
    </div>
    <!-- Footer -->
    <div style="background:#f8f8ff;padding:20px 40px;text-align:center;border-top:1px solid #eeeef8;">
      <div style="font-size:11px;color:#a0a0b8;">© 2024 Ennovyx · Built for students, by students</div>
    </div>
  </div>
</body>
</html>`
        });
        res.json({ ok: true });
    } catch(err) {
        console.error('Welcome email failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
//  EU (ENNOVYX UNIVERSITY) — local JSON data management
// ============================================================
const COURSES_FILE = path.join(__dirname, 'courses.json');
const EU_ADMIN_KEY = process.env.EU_ADMIN_KEY || 'ennovyx-admin-2024';

function loadCourses() {
  try {
    if (fs.existsSync(COURSES_FILE)) return JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
  } catch(e) {}
  return [];
}

function saveCourses(courses) {
  fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2), 'utf8');
}

// List all courses (public)
app.get('/api/university/courses', (req, res) => {
  res.json(loadCourses());
});

// Create course with file uploads (admin only)
app.post('/api/university/courses',
  upload.fields([
    { name: 'videoFile', maxCount: 10 },
    { name: 'pdfFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 }
  ]),
  (req, res) => {
    const adminKey = req.body.adminKey;
    if (adminKey !== EU_ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, category } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const baseUrl = '/university/uploads/';
    
    // Multiple video files
    const videoFiles = req.files?.videoFile || [];
    const videoUrls = videoFiles.map(f => baseUrl + f.filename);
    
    const pdfFile = req.files?.pdfFile?.[0];
    const thumbFile = req.files?.thumbnailFile?.[0];

    const courses = loadCourses();
    const course = {
        id: Date.now().toString(),
        title, description: description || '',
        videoUrls: videoUrls.length ? videoUrls : [],
        videoUrl: videoUrls[0] || null,  // backwards compat
        pdfUrl: pdfFile ? baseUrl + pdfFile.filename : null,
        thumbnail: thumbFile ? baseUrl + thumbFile.filename : null,
        category: category || 'General',
        createdAt: new Date().toISOString(),
        views: 0
    };
    courses.push(course);
    saveCourses(courses);
    res.json(course);
});

// Update course with file uploads (admin only)
app.put('/api/university/courses/:id',
  upload.fields([
    { name: 'videoFile', maxCount: 10 },
    { name: 'pdfFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 }
  ]),
  (req, res) => {
    const adminKey = req.body.adminKey;
    if (adminKey !== EU_ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
    
    const courses = loadCourses();
    const idx = courses.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const baseUrl = '/university/uploads/';
    const { title, description, category } = req.body;
    
    const videoFiles = req.files?.videoFile || [];
    const pdfFile = req.files?.pdfFile?.[0];
    const thumbFile = req.files?.thumbnailFile?.[0];

    const updates = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category) updates.category = category;
    if (videoFiles.length) {
        const newUrls = videoFiles.map(f => baseUrl + f.filename);
        updates.videoUrls = [...(courses[idx].videoUrls || []), ...newUrls];
        updates.videoUrl = updates.videoUrls[0];
    }
    if (pdfFile) updates.pdfUrl = baseUrl + pdfFile.filename;
    if (thumbFile) updates.thumbnail = baseUrl + thumbFile.filename;
    
    courses[idx] = { ...courses[idx], ...updates };
    saveCourses(courses);
    res.json(courses[idx]);
});

// Remove one video from a course
app.delete('/api/university/courses/:id/video', (req, res) => {
    const { adminKey, videoUrl } = req.body;
    if (adminKey !== EU_ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
    const courses = loadCourses();
    const idx = courses.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    courses[idx].videoUrls = (courses[idx].videoUrls || []).filter(u => u !== videoUrl);
    courses[idx].videoUrl = courses[idx].videoUrls[0] || null;
    // Delete file from disk
    try { fs.unlinkSync(path.join(__dirname, videoUrl.replace('/university/uploads/', 'university/uploads/'))); } catch(e) {}
    saveCourses(courses);
    res.json(courses[idx]);
});

// Delete course (admin only)
app.delete('/api/university/courses/:id', (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== EU_ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  
  const courses = loadCourses();
  const filtered = courses.filter(c => c.id !== req.params.id);
  if (filtered.length === courses.length) return res.status(404).json({ error: 'Not found' });
  saveCourses(filtered);
  res.json({ deleted: true });
});

// Track view count
app.post('/api/university/courses/:id/view', (req, res) => {
  const courses = loadCourses();
  const course = courses.find(c => c.id === req.params.id);
  if (course) { course.views = (course.views || 0) + 1; saveCourses(courses); }
  res.json({ ok: true });
});

// Serve university page
app.use('/university', express.static(path.join(__dirname, 'university')));
app.use('/university/uploads', express.static(uploadsDir));
app.get('/university', (req, res) => {
  res.sendFile(path.join(__dirname, 'university', 'index.html'));
});
// Admin panel
app.get('/admin/university', (req, res) => {
  res.sendFile(path.join(__dirname, 'university', 'admin.html'));
});

// ── Dashboard fallback ────────────────────────────────────────
app.use('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n✅ Ennovyx running at http://localhost:${PORT}`);
    console.log(`   Dashboard: http://localhost:${PORT}/dashboard\n`);
});
