# دليل حل المشاكل - AL-Pharmacist Platform

## مشكلة: خطأ في رفع الملفات (ERR_BLOCKED_BY_CLIENT)

### الأعراض

```
Error: خطأ في الشبكة أثناء الرفع
POST http://localhost:3000/api/upload/cloud net::ERR_BLOCKED_BY_CLIENT
```

### السبب

هذا الخطأ يحدث عادةً بسبب:

1. **Ad Blocker** (مانع الإعلانات) يحجب الطلب
2. **Privacy Extensions** (إضافات الخصوصية) تمنع الاتصال
3. **Browser Security Settings** (إعدادات الأمان في المتصفح)

### الحل

#### الحل 1: تعطيل Ad Blocker مؤقتاً

1. افتح إعدادات Ad Blocker في المتصفح
2. أضف `localhost:3000` و `127.0.0.1:5500` إلى القائمة البيضاء
3. أعد تحميل الصفحة وحاول الرفع مرة أخرى

#### الحل 2: استخدام وضع التصفح الخاص (Incognito)

1. افتح نافذة تصفح خاص جديدة
2. تأكد من تعطيل الإضافات في وضع التصفح الخاص
3. افتح المنصة وحاول الرفع

#### الحل 3: تعطيل Privacy Extensions

بعض الإضافات مثل:

- uBlock Origin
- Privacy Badger
- Ghostery
- AdBlock Plus

قد تحجب الطلبات. حاول تعطيلها مؤقتاً.

### التحقق من الحل

بعد تطبيق أي من الحلول أعلاه:

1. افتح Developer Console (F12)
2. انتقل إلى تبويب Network
3. حاول رفع ملف
4. تأكد من عدم ظهور خطأ `ERR_BLOCKED_BY_CLIENT`

---

## مشكلة: الخادم لا يستجيب

### الأعراض

```
Failed to fetch
Connection refused
```

### الحل

1. تأكد من تشغيل الخادم:

   ```bash
   cd backend
   npm run dev
   ```

2. تحقق من أن الخادم يعمل على المنفذ 3000:

   ```bash
   netstat -ano | findstr :3000
   ```

3. تأكد من أن `BACKEND_URL` في `js/config.js` يشير إلى `http://localhost:3000`

---

## مشكلة: خطأ CORS

### الأعراض

```
Access to XMLHttpRequest blocked by CORS policy
```

### الحل

1. تأكد من أن عنوان الواجهة الأمامية مضاف في `.env`:

   ```
   FRONTEND_URL_1=https://a7-m.github.io
   FRONTEND_URL_2=http://127.0.0.1:5500
   ```

2. أعد تشغيل الخادم بعد تعديل `.env`

---

## مشكلة: Google Drive Authentication

### الأعراض

- نافذة تسجيل الدخول لا تظهر
- خطأ "Google Auth not initialized"

### الحل

1. تأكد من تحميل `google-drive.js` في الصفحة:

   ```html
   <script src="../js/google-drive.js"></script>
   ```

2. تأكد من استدعاء `loadGoogleScripts()` قبل الرفع

3. تحقق من صحة `GOOGLE_CLIENT_ID` في `js/config.js`

---

## مشكلة: رفع الملفات الكبيرة

### الأعراض

- الرفع يتوقف عند نسبة معينة
- خطأ "Request Entity Too Large"

### الحل

1. تحقق من حد حجم الملف في `backend/server.js`:

   ```javascript
   limits: {
     fileSize: 100 * 1024 * 1024; // 100MB
   }
   ```

2. للملفات الأكبر من 100MB، استخدم Google Drive بدلاً من Cloudinary

---

## معلومات إضافية

### سجلات الأخطاء

- **Frontend**: افتح Developer Console (F12) → Console
- **Backend**: تحقق من Terminal حيث يعمل الخادم

### الدعم الفني

إذا استمرت المشكلة، يرجى تقديم:

1. لقطة شاشة من Developer Console
2. رسالة الخطأ الكاملة
3. الخطوات التي اتبعتها قبل حدوث الخطأ
