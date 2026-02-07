# إعداد Google Drive Upload

## الخطوات المطلوبة لتفعيل رفع الملفات إلى Google Drive

### 1. إعداد Google Cloud Console

1. افتح [Google Cloud Console](https://console.cloud.google.com/)
2. اختر المشروع الخاص بك أو أنشئ مشروعاً جديداً
3. انتقل إلى **APIs & Services** > **Credentials**
4. اختر OAuth 2.0 Client ID الموجود أو أنشئ واحداً جديداً
5. في قسم **Authorized redirect URIs**، أضف:
   - `http://localhost:3000/api/auth/google/callback` (للتطوير المحلي)
   - `https://your-production-domain.com/api/auth/google/callback` (للإنتاج)
6. في قسم **Authorized JavaScript origins**، أضف:
   - `http://127.0.0.1:5500` (للتطوير المحلي)
   - `https://a7-m.github.io` (للإنتاج)
   - `http://localhost:5500`

### 2. تفعيل Google Drive API

1. في Google Cloud Console، انتقل إلى **APIs & Services** > **Library**
2. ابحث عن "Google Drive API"
3. اضغط على **Enable**

### 3. التحقق من ملف .env

تأكد من أن ملف `.env` في مجلد `backend` يحتوي على:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_API_KEY=your-api-key
```

### 4. إعادة تشغيل الخادم

بعد إجراء التغييرات، أعد تشغيل الخادم:

```bash
cd backend
npm start
```

## كيفية الاستخدام

1. في صفحة إضافة فيديو أو ملف، اختر "Google Drive" كمصدر الرفع
2. اختر الملف المراد رفعه
3. عند الضغط على "نشر"، ستظهر نافذة تسجيل الدخول إلى Google
4. امنح الصلاحيات المطلوبة
5. سيتم رفع الملف تلقائياً إلى Google Drive

## ملاحظات مهمة

- يتطلب رفع Google Drive تسجيل دخول المستخدم إلى حساب Google
- الملفات المرفوعة ستكون مرئية للجميع (public)
- يتم حفظ معلومات الملف في قاعدة البيانات مع `google_drive_id`
- يمكن للمستخدم التبديل بين Cloudinary و Google Drive حسب الحاجة

## استكشاف الأخطاء

### خطأ: "Google Auth not initialized"

- تأكد من تحميل صفحة الإدارة بالكامل قبل محاولة الرفع
- أعد تحميل الصفحة

### خطأ: "رمز الوصول إلى Google مفقود"

- تأكد من تسجيل الدخول إلى Google عند الطلب
- تحقق من أن Redirect URIs مضافة بشكل صحيح في Google Cloud Console

### خطأ: "Failed to load Google API"

- تحقق من اتصال الإنترنت
- تأكد من أن `GOOGLE_CLIENT_ID` صحيح في ملف `config.js`
