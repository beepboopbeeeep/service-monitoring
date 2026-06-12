# 🚀 پنل مانیتورینگ سرورها - Cloudflare Worker

## 📋 ویژگی‌های اصلی

### ✅ قابلیت‌های پیاده‌سازی شده:

1. **مانیتورینگ خودکار سرورها**
   - چک کردن ساعتی سرورها با استفاده از Cron Triggers
   - تشخیص وضعیت: فعال، سنگینی بار، غیرفعال
   - ذخیره تاریخچه 4500 رکوردی

2. **تست لحظه‌ای دامنه**
   - امکان تست هر دامنه‌ای از طریق پنل
   - نمایش زمان پاسخ (Response Time)
   - نمایش کد وضعیت HTTP
   - تحلیل محتوای صفحه برای تعیین وضعیت

3. **پنل ادمین کامل**
   - احراز هویت با رمز عبور
   - افزودن سرور جدید با مشخصات کامل (نام، URL، تاریخ تمدید، رنگ)
   - ویرایش سرورهای موجود
   - حذف سرورها
   - لیست تمام سرورها با وضعیت فعلی
   - توکن دسترسی 24 ساعته

4. **محاسبه هوشمند تاریخ تمدید**
   - پشتیبانی از تاریخ شمسی
   - محاسبه خودکار روزهای باقی‌مانده
   - نمایش "نامحدود" برای سرویس‌های بدون انقضا
   - هشدار برای سرورهای منقضی شده

5. **نمودارهای تحلیلی**
   - نمودار ساعتی (آخرین روز)
   - نمودار روزانه (ماه گذشته)
   - تبدیل خودکار تاریخ میلادی به شمسی
   - نمایش اعداد فارسی

6. **رابط کاربری پیشرفته**
   - طراحی Glassmorphism
   - کاملاً ریسپانسیو
   - انیمیشن‌های smooth
   - تم تیره با رنگ طلایی
   - فونت وزیرمتن

7. **ذخیره‌سازی KV**
   - استفاده از Cloudflare KV Storage
   - دسترسی سریع به داده‌ها
   - نگهداری تاریخچه کامل

---

## 🎯 ویژگی‌های پیشنهادی اضافی

### 🔔 سیستم اطلاع‌رسانی (Notifications)
- **Email Alerts**: ارسال ایمیل هنگام قطعی سرور
- **Telegram Bot**: ارسال پیام به تلگرام
- **SMS Notifications**: پیامک برای موارد حیاتی
- **Webhook Support**: اتصال به سرویس‌های خارجی

### 📊 گزارش‌گیری پیشرفته
- **Export Data**: خروجی Excel/CSV از تاریخچه
- **Uptime Percentage**: محاسبه درصد آپ‌تایم ماهانه
- **Response Time Charts**: نمودار زمان پاسخگویی
- **Status Distribution**: نمودار دایره‌ای توزیع وضعیت

### 🔐 امنیت بیشتر
- **Two-Factor Authentication**: احراز هویت دو مرحله‌ای
- **IP Whitelist**: محدود کردن دسترسی به IPهای خاص
- **Rate Limiting**: جلوگیری از حملات Brute Force
- **Session Management**: مدیریت پیشرفته نشست‌ها

### 🌐 چندزبانه
- **English/Persian Toggle**: امکان تغییر زبان
- **RTL/LTR Support**: پشتیبانی کامل از هر دو جهت

### 📱 اپلیکیشن موبایل
- **PWA Support**: نصب به عنوان اپلیکیشن
- **Push Notifications**: نوتیفیکیشن پوش
- **Offline Mode**: مشاهده آخرین داده‌ها بدون اینترنت

### 🔧 امکانات مدیریتی
- **Bulk Operations**: عملیات گروهی روی سرورها
- **Import/Export**: ورود/خروج لیست سرورها
- **Tags/Categories**: دسته‌بندی سرورها
- **Custom Status Codes**: تعریف وضعیت‌های سفارشی
- **Maintenance Mode**: حالت تعمیرات برای سرورها

### 📈 مانیتورینگ پیشرفته
- **SSL Certificate Check**: بررسی تاریخ انقضای SSL
- **DNS Resolution Check**: بررسی سلامت DNS
- **Port Monitoring**: مانیتورینگ پورت‌های خاص
- **API Endpoint Testing**: تست endpointهای API
- **Content Change Detection**: تشخیص تغییر در محتوا

### 🤖 اتوماسیون
- **Auto-Renewal Reminders**: یادآوری خودکار تمدید
- **Scheduled Reports**: گزارش‌های زمان‌بندی شده
- **Auto-Scaling Triggers**: تریگر برای auto-scaling
- **Integration with CI/CD**: اتصال به پایپلاین‌ها

---

## 🛠️ نحوه راه‌اندازی

### پیش‌نیازها
- حساب Cloudflare (رایگان)
- Node.js نصب شده روی سیستم

### مراحل نصب

#### 1. نصب Wrangler CLI
```bash
npm install -g wrangler
```

#### 2. ورود به Cloudflare
```bash
wrangler login
```

#### 3. ساخت KV Namespace
```bash
wrangler kv:namespace create "MONITOR_DATA"
```
خروجی دستور بالا شامل یک ID است که باید در فایل `wrangler.toml` کپی کنید.

#### 4. ویرایش فایل wrangler.toml
```toml
[[kv_namespaces]]
binding = "MONITOR_DATA"
id = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"  # ID را اینجا قرار دهید
```

#### 5. تنظیم رمز عبور ادمین
```bash
wrangler secret put ADMIN_PASSWORD
```
رمز عبور دلخواه خود را وارد کنید.

#### 6. دیپلوی کردن
```bash
wrangler deploy
```

#### 7. دسترسی به پنل
آدرس Worker را باز کنید:
```
https://server-monitor-panel.<your-subdomain>.workers.dev
```

---

## 📡 API Endpoints

### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data` | دریافت داده‌های فعلی |
| GET | `/api/history` | دریافت تاریخچه کامل |
| POST | `/api/test-domain` | تست لحظه‌ای دامنه |

### Admin Endpoints (نیاز به احراز هویت)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | ورود ادمین |
| GET | `/api/admin/servers` | دریافت لیست سرورها |
| POST | `/api/admin/servers` | افزودن سرور جدید |
| PUT | `/api/admin/servers` | بروزرسانی سرور |
| DELETE | `/api/admin/servers?id=X` | حذف سرور |
| POST | `/api/admin/check-all` | چک کردن فوری همه سرورها |

---

## 🔑 نمونه درخواست‌ها

### تست دامنه
```javascript
fetch('https://your-worker.workers.dev/api/test-domain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'https://example.com' })
})
```

### ورود ادمین
```javascript
fetch('https://your-worker.workers.dev/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'your-password' })
})
```

### افزودن سرور
```javascript
fetch('https://your-worker.workers.dev/api/admin/servers', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: JSON.stringify({
        name: 'سرویس جدید',
        url: 'https://new-server.example.com/login',
        renewal_date: '1405/12/21',
        color: '#C7A46C'
    })
})
```

---

## ⚙️ تنظیمات Cron Job

برای تغییر زمان‌بندی چک کردن سرورها، فایل `wrangler.toml` را ویرایش کنید:

```toml
[triggers]
crons = ["0 * * * *"]  # هر ساعت
```

### الگوهای Cron نمونه:
- `* * * * *` - هر دقیقه
- `*/5 * * * *` - هر 5 دقیقه
- `0 */2 * * *` - هر 2 ساعت
- `0 0 * * *` - هر روز نیمه شب
- `0 8 * * *` - هر روز ساعت 8 صبح
- `0 */6 * * *` - هر 6 ساعت

---

## 📝 ساختار داده‌ها

### Server Object
```json
{
    "id": "1234567890",
    "name": "سرویس مرکزی",
    "url": "https://example.com/login",
    "renewal_date": "1405/12/21",
    "color": "#C7A46C",
    "created_at": "2024-01-01T00:00:00Z"
}
```

### Service Status Object
```json
{
    "name": "سرویس مرکزی",
    "status": "active",
    "renewal_date": "1405/12/21",
    "days_remaining": 45,
    "message": "تبریک! سرویس شما با موفقیت در حال فعالیت است.",
    "url": "https://example.com/login",
    "color": "#C7A46C",
    "response_time": 234
}
```

### History Entry
```json
{
    "timestamp": "2024-01-01T12:00:00Z",
    "time_label": "۱۲:۰۰",
    "service_name": "سرویس مرکزی",
    "status": "active"
}
```

---

## 🎨 شخصی‌سازی ظاهر

برای تغییر تم رنگی، متغیرهای CSS در بخش `<style>` را ویرایش کنید:

```css
:root {
    --bg-color: #1E1E1E;          /* رنگ پس‌زمینه */
    --primary-color: #C7A46C;      /* رنگ اصلی */
    --text-color: #E0E0E0;         /* رنگ متن */
    --success-color: #4CAF50;      /* رنگ وضعیت فعال */
    --warning-color: #FFC107;      /* رنگ هشدار */
    --danger-color: #F44336;       /* رنگ خطا */
}
```

---

## 🔧 عیب‌یابی

### مشکل: داده‌ها نمایش داده نمی‌شوند
- بررسی کنید KV Namespace ساخته شده باشد
- ID صحیح در `wrangler.toml` قرار گرفته باشد
- حداقل یک سرور اضافه کرده باشید

### مشکل: چک کردن ساعتی کار نمی‌کند
- بررسی کنید Cron Trigger فعال باشد
- در Cloudflare Dashboard به بخش Workers > Triggers بروید
- مطمئن شوید Cron Job ثبت شده است

### مشکل: رمز عبور ادمین کار نمی‌کند
- با دستور `wrangler secret put ADMIN_PASSWORD` رمز را مجدداً تنظیم کنید
- کش مرورگر را پاک کنید

---

## 📄 مجوز

این پروژه به صورت Open Source منتشر شده است.

---

## 🤝 پشتیبانی

برای گزارش مشکلات یا پیشنهاد ویژگی‌های جدید، لطفاً از طریق Issues اقدام کنید.

---

## 📚 منابع مفید

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [KV Storage Guide](https://developers.cloudflare.com/kv/)
- [Cron Triggers](https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
