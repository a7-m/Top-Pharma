// backend/server.js
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client (Service Role for Admin updates)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'الرمز المميز مفقود.' });
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: 'جلسة غير صالحة. يرجى تسجيل الدخول.' });
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    res.status(403).json({ error: 'لا تملك صلاحية الإدارة.' });
    return null;
  }

  return userData.user;
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

