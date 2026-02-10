import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// ============================================================
// ⚙️ تنظیمات و لیست سرویس‌ها (اینجا را ویرایش کنید)
// ============================================================
const servers = [
    {
        id: "server1", // یک شناسه یکتا انگلیسی
        name: "سرویس مرکزی",
        url: "https://tellmeimright.taxyvy.workers.dev/panel",
        // فرمت تاریخ: YYYY/MM/DD شمسی یا "unlimited" برای نامحدود
        renewalDate: "unlimited", 
        referralCode: "MAIN_SRV"
    },
    {
        id: "server2",
        name: "سرویس سلطان",
        url: "https://hitmeintheyes.judiopu.workers.dev/panel",
        renewalDate: "1404/12/21",
        referralCode: "SOLTAN_VIP"
    }
    // برای اضافه کردن سرویس جدید، یک بلوک مثل بالا اضافه کنید
];
// ============================================================

const DATA_FILE = 'data.json';
const MAX_HISTORY_POINTS = 720; // نگهداری دیتای حدود یک ماه (برای نمودارها)

async function checkServer(server) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 ثانیه تایم‌اوت

        const response = await fetch(server.url, { 
            signal: controller.signal,
            headers: { 'User-Agent': 'MonitoringBot/1.0' }
        });
        clearTimeout(timeout);

        const text = await response.text();
        const statusText = text.toLowerCase();

        // منطق تشخیص وضعیت طبق درخواست شما
        if (statusText.includes('panel')) {
            return { status: 'active', msg: 'فعال' };
        } else if (statusText.includes('rate') || statusText.includes('1027')) {
            return { status: 'warning', msg: 'سنگینی بار سرور' };
        } else {
            // شامل 1101 یا هر چیز دیگر
            return { status: 'inactive', msg: 'غیرفعال' };
        }

    } catch (error) {
        return { status: 'inactive', msg: 'خطای اتصال' };
    }
}

async function run() {
    let existingData = { history: {}, lastUpdate: Date.now() };
    
    // خواندن دیتای قبلی اگر وجود داشته باشد
    if (fs.existsSync(DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            console.log("Creating new data file.");
        }
    }

    const timestamp = Date.now();
    const results = [];

    for (const server of servers) {
        const result = await checkServer(server);
        
        // آماده‌سازی آبجکت برای ذخیره
        if (!existingData.history[server.id]) {
            existingData.history[server.id] = [];
        }

        // اضافه کردن رکورد جدید به تاریخچه
        existingData.history[server.id].push({
            t: timestamp,
            s: result.status // saving space
        });

        // محدود کردن حجم دیتا (حذف قدیمی‌ها)
        if (existingData.history[server.id].length > MAX_HISTORY_POINTS) {
            existingData.history[server.id].shift();
        }

        results.push({
            ...server,
            currentStatus: result.status,
            currentMsg: result.msg
        });
    }

    // خروجی نهایی ترکیبی از کانفیگ و هیستوری
    const finalOutput = {
        lastUpdate: timestamp,
        servers: results, // لیست سرورها با وضعیت لحظه‌ای
        history: existingData.history // تاریخچه برای نمودار
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalOutput, null, 2));
    console.log("Update complete.");
}

run();
