// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Import custom modules
const { 
  checkSectionAccess, 
  checkVideoAccess, 
  checkQuizAccess, 
  checkFileAccess 
} = require('./middleware/access-control');
const { generateSignedUrl, verifySignedUrl } = require('./utils/signed-urls');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CLOUDINARY CONFIG =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ===== MULTER CONFIG (File Upload) =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  }
});

// ===== SECURITY MIDDLEWARE =====

// Helmet for HTTP security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration - Restrict to frontend only
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://127.0.0.1:5500',
      'http://localhost:5500'
    ];
    
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقًا.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== SUPABASE CLIENT =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===== AUTHENTICATION MIDDLEWARE =====

/**
 * Verify user session and return user data
 */
async function requireAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'الرمز المميز مفقود. يرجى تسجيل الدخول.' });
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'جلسة غير صالحة. يرجى تسجيل الدخول.' });
    return null;
  }

  return userData.user;
}

/**
 * Require admin role
 */
async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    res.status(403).json({ error: 'لا تملك صلاحية الإدارة.' });
    return null;
  }

  return user;
}

// ===== ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== CLOUDINARY UPLOAD =====
app.post('/api/upload/cloudinary', 
  upload.single('file'),
  async (req, res) => {
    try {
      const adminUser = await requireAdmin(req, res);
      if (!adminUser) return;

      if (!req.file) {
        return res.status(400).json({ error: 'لم يتم تحميل ملف.' });
      }

      const resourceType = req.body.resourceType || 'video';
      const folder = req.body.folder || `Top Pharma/${resourceType}s`;

      // Upload to Cloudinary using upload_stream
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: resourceType,
            folder: folder,
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.end(req.file.buffer);
      });

      res.json({
        success: true,
        secure_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        duration: uploadResult.duration ? Math.round(uploadResult.duration) : null
      });

    } catch (error) {
      console.error('Cloudinary upload error:', error);
      res.status(500).json({ error: 'فشل رفع الملف إلى Cloudinary.' });
    }
  }
);

// ===== GOOGLE DRIVE UPLOAD =====
// Note: For Google Drive, you'll need to set up a Service Account
// For now, this is a placeholder that returns an error
app.post('/api/upload/google-drive',
  upload.single('file'),
  async (req, res) => {
    try {
      const adminUser = await requireAdmin(req, res);
      if (!adminUser) return;

      // TODO: Implement Google Drive upload using Service Account
      // This requires additional setup with Google Cloud Console
      
      res.status(501).json({ 
        error: 'رفع Google Drive غير مفعّل حاليًا. يرجى استخدام Cloudinary.' 
      });

    } catch (error) {
      console.error('Google Drive upload error:', error);
      res.status(500).json({ error: 'فشل رفع الملف إلى Google Drive.' });
    }
  }
);

// ===== CONTENT ACCESS VERIFICATION =====
app.post('/api/verify-access',
  body('sectionId').isInt(),
  body('contentType').isIn(['section', 'video', 'quiz', 'file']),
  async (req, res) => {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sectionId, contentType, contentId } = req.body;
      let hasAccess = false;

      switch (contentType) {
        case 'section':
          hasAccess = await checkSectionAccess(user.id, sectionId);
          break;
        case 'video':
          hasAccess = await checkVideoAccess(user.id, contentId);
          break;
        case 'quiz':
          hasAccess = await checkQuizAccess(user.id, contentId);
          break;
        case 'file':
          hasAccess = await checkFileAccess(user.id, contentId);
          break;
      }

      res.json({ hasAccess });

    } catch (error) {
      console.error('Verify access error:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الصلاحية.' });
    }
  }
);

// ===== GENERATE SIGNED URL =====
app.post('/api/generate-signed-url',
  body('contentId').notEmpty(),
  body('contentType').isIn(['video', 'quiz', 'file']),
  async (req, res) => {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { contentId, contentType } = req.body;

      // Verify access first
      let hasAccess = false;
      switch (contentType) {
        case 'video':
          hasAccess = await checkVideoAccess(user.id, contentId);
          break;
        case 'quiz':
          hasAccess = await checkQuizAccess(user.id, contentId);
          break;
        case 'file':
          hasAccess = await checkFileAccess(user.id, contentId);
          break;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'ليس لديك صلاحية الوصول لهذا المحتوى.' });
      }

      // Generate signed URL
      const { signedParams, expiresAt } = generateSignedUrl(
        contentId,
        contentType,
        user.id
      );

      res.json({
        success: true,
        signedParams,
        expiresAt
      });

    } catch (error) {
      console.error('Generate signed URL error:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء توليد رابط الوصول.' });
    }
  }
);

// ===== VERIFY SIGNED URL =====
app.post('/api/verify-signed-url', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { signedParams } = req.body;

    if (!signedParams) {
      return res.status(400).json({ error: 'معاملات التوقيع مفقودة.' });
    }

    // Verify the signature
    const isValid = verifySignedUrl(signedParams);

    if (!isValid) {
      return res.status(403).json({ error: 'رابط غير صالح أو منتهي الصلاحية.' });
    }

    // Verify user ID matches
    if (signedParams.userId !== user.id) {
      return res.status(403).json({ error: 'هذا الرابط غير مخصص لك.' });
    }

    res.json({ valid: true });

  } catch (error) {
    console.error('Verify signed URL error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الرابط.' });
  }
});

// ===== EXISTING ADMIN ROUTES =====

app.post('/api/admin/delete-user', async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'معرّف المستخدم مطلوب.' });
    }

    if (userId === adminUser.id) {
      return res.status(400).json({ error: 'لا يمكن حذف حسابك الحالي.' });
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Delete user error:', deleteError);
      return res.status(500).json({ error: 'تعذر حذف المستخدم.' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء حذف المستخدم.' });
  }
});

app.post('/api/admin/last-seen', async (req, res) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const { userIds } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.json({ lastSeen: {} });
    }

    const results = await Promise.all(userIds.map(async (userId) => {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(userId);
        if (error || !data?.user) {
          return [userId, null];
        }
        return [userId, data.user.last_sign_in_at || null];
      } catch (fetchError) {
        console.warn('Failed to fetch last seen for user', userId, fetchError);
        return [userId, null];
      }
    }));

    const lastSeen = Object.fromEntries(results);
    return res.json({ lastSeen });
  } catch (error) {
    console.error('Admin last seen error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء تحميل آخر ظهور.' });
  }
});

// ===== ERROR HANDLERS =====

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'المسار غير موجود.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'الوصول محظور من هذا النطاق.' });
  }
  
  res.status(500).json({ error: 'حدث خطأ في الخادم.' });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🔒 Secure Server running on port ${PORT}`);
  console.log(`📍 CORS allowed origin: ${process.env.FRONTEND_URL}`);
  console.log(`⚡ Rate limit: ${process.env.RATE_LIMIT_MAX_REQUESTS} requests per ${parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 60000} minutes`);
});
