# حل مشكلة رفع الملفات - Google Drive Upload Fix

## المشكلة

كانت المشكلة تحدث بسبب **Ad Blocker** أو **Privacy Extensions** في المتصفح التي تحجب الطلبات التي تحتوي على كلمة "google-drive" في المسار.

## الحل المطبق

### 1. تغيير اسم المسار (Endpoint)

تم تغيير المسار من:

```
/api/upload/google-drive  ❌
```

إلى:

```
/api/upload/cloud  ✅
```

### 2. الملفات المعدلة

#### Backend (`backend/server.js`)

```javascript
// قبل
app.post('/api/upload/google-drive', ...)

// بعد
app.post('/api/upload/cloud', ...)
```

#### Frontend (`js/google-drive.js`)

```javascript
// قبل
xhr.open("POST", `${BACKEND_URL}/api/upload/google-drive`, true);

// بعد
xhr.open("POST", `${BACKEND_URL}/api/upload/cloud`, true);
```

### 3. تحسين رسائل الخطأ

تم تحسين رسالة الخطأ لتوضيح السبب المحتمل:

```javascript
xhr.onerror = () => {
  reject(
    new Error(
      "خطأ في الشبكة أثناء الرفع. تأكد من تعطيل Ad Blocker أو Privacy Extensions.",
    ),
  );
};
```

## كيفية الاختبار

### 1. تشغيل الخادم

```bash
cd backend
npm run dev
```

### 2. فتح الصفحة

افتح `admin/add-video.html` أو `admin/add-file.html`

### 3. اختبار الرفع

1. اختر ملف للرفع
2. اختر "Google Drive" كمصدر الرفع
3. انقر على "رفع"
4. يجب أن تظهر نافذة تسجيل الدخول إلى Google
5. بعد الموافقة، سيبدأ الرفع

## إذا استمرت المشكلة

### الحل 1: تعطيل Ad Blocker

1. افتح إعدادات Ad Blocker
2. أضف `localhost:3000` إلى القائمة البيضاء
3. أعد تحميل الصفحة

### الحل 2: استخدام Cloudinary بدلاً من Google Drive

1. اختر "Cloudinary" كمصدر الرفع
2. لن تحتاج لتسجيل الدخول إلى Google
3. الرفع سيكون مباشراً

### الحل 3: استخدام وضع التصفح الخاص

1. افتح نافذة Incognito/Private
2. تأكد من تعطيل الإضافات
3. افتح المنصة وحاول الرفع

## ملاحظات مهمة

### متطلبات Google Drive Upload

- تسجيل الدخول إلى Google مطلوب
- يجب السماح للتطبيق بالوصول إلى Google Drive
- الملفات ستُرفع إلى حساب Google Drive الخاص بالمستخدم

### متطلبات Cloudinary Upload

- لا يحتاج تسجيل دخول
- الرفع مباشر وسريع
- مناسب للملفات الصغيرة والمتوسطة (حتى 100MB)

### الفرق بين الخيارين

| الميزة            | Google Drive | Cloudinary       |
| ----------------- | ------------ | ---------------- |
| تسجيل الدخول      | مطلوب        | غير مطلوب        |
| الحد الأقصى للحجم | 5GB          | 100MB            |
| السرعة            | متوسطة       | سريعة            |
| التخزين           | Google Drive | Cloudinary Cloud |
| Ad Blocker Issues | محتمل        | نادر             |

## الدعم الفني

للمزيد من المساعدة، راجع ملف `TROUBLESHOOTING.md`
