# 🏆 وكيل المقيم الذكي — MVP
### جائزة الملك عبدالعزيز للجودة 2022

---

## ⏱️ وقت الإعداد: 30-45 دقيقة

---

## الخطوة 1 — إنشاء حساب Supabase (5 دقائق)

1. اذهب إلى [supabase.com](https://supabase.com) وسجل حساباً مجانياً
2. أنشئ مشروعاً جديداً باسم `kaqa-assessment`
3. من القائمة الجانبية → **SQL Editor** → الصق محتوى ملف `supabase/schema.sql` واضغط Run
4. من **Settings → API** انسخ:
   - `Project URL` → هذا هو `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → هذا هو `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → هذا هو `SUPABASE_SERVICE_ROLE_KEY`

---

## الخطوة 2 — إنشاء مفتاح Anthropic (2 دقيقة)

1. اذهب إلى [console.anthropic.com](https://console.anthropic.com)
2. من **API Keys** أنشئ مفتاحاً جديداً
3. انسخه → هذا هو `ANTHROPIC_API_KEY`

---

## الخطوة 3 — إنشاء أول مستخدم في Supabase (3 دقائق)

من Supabase Dashboard → **Authentication → Users → Add User**:

```
Email: abdullah@yourorg.sa
Password: (اختر كلمة مرور قوية)
```

ثم من **SQL Editor** شغل:
```sql
-- إضافة دور المدير لأول مستخدم
UPDATE profiles 
SET full_name = 'عبدالله', role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'abdullah@yourorg.sa');

-- إضافة مستخدمين آخرين بنفس الطريقة
```

---

## الخطوة 4 — رفع المشروع على Vercel (10 دقائق)

### الطريقة السريعة (GitHub):
1. ارفع المجلد على GitHub كـ repository جديد
2. اذهب إلى [vercel.com](https://vercel.com) → Import Project
3. اختر الـ repository
4. في **Environment Variables** أضف:

```
ANTHROPIC_API_KEY        = sk-ant-xxxxx
NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY = eyJxxxxx
```

5. اضغط **Deploy** ✅

---

## الخطوة 5 — تشغيل محلي للتطوير

```bash
# نسخ ملف المتغيرات
cp .env.example .env.local
# حرر الملف وأضف قيمك الحقيقية

# تثبيت المكتبات
npm install

# تشغيل المشروع
npm run dev

# افتح المتصفح على
http://localhost:3000
```

---

## 🏗️ بنية المشروع

```
kaqa-mvp/
├── pages/
│   ├── index.js          ← التطبيق الرئيسي (محمي بتسجيل الدخول)
│   ├── login.js          ← صفحة تسجيل الدخول
│   ├── _app.js           ← إدارة الجلسة والمصادقة
│   └── api/
│       ├── assess.js     ← 🔐 الوكيل الآمن (API key على السيرفر)
│       ├── assessments/
│       │   └── index.js  ← قائمة وحذف التقييمات
│       └── auth/
│           └── me.js     ← بيانات المستخدم الحالي
├── lib/
│   └── supabase.js       ← اتصال قاعدة البيانات
├── styles/
│   └── globals.css
├── supabase/
│   └── schema.sql        ← جداول قاعدة البيانات وصلاحياتها
├── .env.example          ← نموذج المتغيرات المطلوبة
└── package.json
```

---

## 🔐 الأمان المُحقق في هذا MVP

| المشكلة | الحل |
|---------|------|
| API key مكشوف | ✅ ينتقل إلى Server-side فقط |
| لا تسجيل دخول | ✅ Supabase Auth مع email/password |
| لا قاعدة بيانات | ✅ Supabase PostgreSQL |
| لا سجل تدقيق | ✅ جدول `audit_log` يسجل كل إجراء |
| لا صلاحيات | ✅ Row Level Security في Supabase |

---

## 👥 إضافة مستخدمين جدد

من Supabase Dashboard → Authentication → Users → Add User

ثم تحديث الدور من SQL Editor:
```sql
UPDATE profiles SET role = 'assessor' WHERE id = '...';
-- الأدوار المتاحة: admin | manager | assessor
```

---

## 📞 دعم

في حال واجهت أي مشكلة في الإعداد، راجع:
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
