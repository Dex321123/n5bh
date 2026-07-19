# 🤖 بوت الكومينتي - Discord Bot

بوت دسكورد كامل ومرتب للكومينتي مع أنظمة DM، إحصائيات، نقاط، حماية، وتحذيرات.

## 🚀 رفع على GitHub + استضافة (شهر أو أكثر)

المشروع جاهز للربط مع GitHub و **Render** / **Railway**.

### الخطوة 1 — رفع المشروع على GitHub

1. سجّل في [github.com](https://github.com)
2. **New repository** → سمّه مثلاً `discord-bot`
3. في PowerShell داخل مجلد `بوت`:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/discord-bot.git
git push -u origin main
```

> **مهم:** ملف `.env` ما يرفع — محمي في `.gitignore`. التوكن يُحط في موقع الاستضافة فقط.

---

### الخطوة 2 — Render (يدعم GitHub مباشرة) ⭐ أنصح فيه

1. سجّل في [render.com](https://render.com) بحساب GitHub
2. **New +** → **Blueprint** أو **Background Worker**
3. **Connect GitHub** → اختر الريبو
4. Render يقرأ `render.yaml` تلقائياً
5. في **Environment** أضف:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
   - `OWNER_ID`
6. **Deploy**

البوت يشغّل `npm run start:host` (يسجّل الأوامر + يشغّل البوت).

---

### الخطوة 3 — Railway (بديل — يدعم GitHub)

1. [railway.app](https://railway.app) → Login with GitHub
2. **New Project** → **Deploy from GitHub repo**
3. اختر الريبو
4. **Variables** → أضف نفس المتغيرات الأربعة
5. **Start Command:** `npm run start:host`

---

### ملخص المتغيرات في الاستضافة

| Variable | القيمة |
|----------|--------|
| `DISCORD_TOKEN` | توكن البوت |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | آي دي السيرفر |
| `OWNER_ID` | آي دي حسابك |

---

## 📦 التثبيت المحلي

### 1. المتطلبات
- [Node.js 18+](https://nodejs.org/)

### 2. التثبيت
```bash
npm install
```

### 3. الإعداد
انسخ `.env.example` إلى `.env` وعبّي القيم:
```
DISCORD_TOKEN=توكن_البوت
CLIENT_ID=آي_دي_البوت
GUILD_ID=آي_دي_السيرفر
OWNER_ID=آي_دي_حسابك
```

### 4. تسجيل الأوامر
```bash
npm run deploy
```

### 5. تشغيل البوت
```bash
npm start
```

---

## ⚙️ ملفات الإعداد (Config)

| الملف | الوظيفة |
|-------|---------|
| `config/main.js` | الإعدادات الرئيسية، رتب التحذير، الجدولة، صحصح |
| `config/dm.js` | نصوص لوحة DM والقوانين |
| `config/levels.js` | النقاط، المستويات، المكافآت |
| `config/protection.js` | حماية الرومات/الرتب وكشف إساءة الصلاحيات |

---

## 📋 الأوامر

| الأمر | الوصف |
|-------|-------|
| `/adddm` | يرسل لوحة DM في القناة (زر شخص + زر رتبة) |
| `/stats` | إحصائيات السيرفر |
| `/rank` | مستواك ونقاطك |
| `/leaderboard` | لوحة المتصدرين |
| `/صحصح @شخص 5` | ينقل الشخص بين رومين (حد أقصى 5 ثواني) |

---

## 🛡️ الأنظمة

### نظام DM
- `/adddm` يرسل إمبد في القناة مع القوانين
- زر **إرسال DM لشخص** → تختار الشخص وتكتب الرسالة
- زر **إرسال DM لرتبة** → يرسل لكل أعضاء الرتبة

### نظام الإحصائيات
- عدد الأعضاء، المتصلين، البوتات، Ping، حالة البوت
- يتحدث تلقائياً في القناة المحددة (`statsChannelId` في config)

### نظام النقاط
- نقاط لكل رسالة (مع كولداون ضد السبام)
- مستويات + Leaderboard
- مكافآت رتب عند مستويات معينة

### شكر البوستات
- أول ما أحد يسوي بوست في الفورم → البوت يشكره

### حماية الرتب والرومات
- أي شخص يعدّل روم/رتبة بدون صلاحية → **باند فوري** + استرجاع التغيير

### كشف إساءة الصلاحيات
1. تحذير بالخاص
2. Warn 1 → Warn 2 → Warn 3 (الرتب محددة في config)
3. بعد Warn 3 → سحب صلاحيات الإدارة

### نظام الجدولة
- يرسل DM عشوائي لعضو عشوائي كل فترة (قابلة للتعديل)

---

## 🔧 صلاحيات البوت المطلوبة

- Administrator (أو على الأقل):
  - Manage Channels, Manage Roles
  - Ban Members, Move Members
  - Send Messages, Embed Links
  - View Audit Log
  - Manage Messages

## 📝 Intents المطلوبة (Developer Portal)

- Server Members Intent
- Message Content Intent
- Presence Intent (لعدد المتصلين)

---

## 📁 هيكل المشروع

```
بوت/
├── config/          ← عدّل من هنا
├── data/            ← قاعدة البيانات (تلقائي)
├── src/
│   ├── commands/    ← Slash Commands
│   ├── events/      ← أحداث Discord
│   ├── systems/     ← منطق الأنظمة
│   └── utils/       ← أدوات مساعدة
├── .env
└── package.json
```
