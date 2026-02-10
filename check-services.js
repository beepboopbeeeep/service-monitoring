const fs = require('fs');
const https = require('https');
const http = require('http');

const SERVICES = [
  {
    name: "سرویس مرکزی",
    url: "https://tellmeimright.taxyvy.workers.dev/panel",
    renewalDate: null
  },
  {
    name: "سرویس سلطان",
    url: "https://hitmeimintheyes.judiopu.workers.dev/panel",
    renewalDate: "2026-03-11"
  }
];

// تابع دریافت صفحه
function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          responseTime: Date.now() - startTime,
          body: data,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        responseTime: Date.now() - startTime,
        body: '',
        error: err.message
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        statusCode: 0,
        responseTime: 10000,
        body: '',
        error: 'Timeout'
      });
    });
  });
}

// تشخیص وضعیت از محتوا
function detectStatus(response) {
  const body = response.body.toLowerCase();
  
  if (body.includes('panel')) {
    return { status: 'active', message: '✅ سرویس فعال است' };
  } else if (body.includes('rate') || body.includes('1027') || response.statusCode === 429) {
    return { status: 'heavy', message: '⏳ سنگینی بار روی سرور' };
  } else if (body.includes('1101') || response.statusCode === 404 || response.statusCode === 0) {
    return { status: 'inactive', message: '❌ سرویس غیرفعال است' };
  } else {
    return { status: 'unknown', message: '⚠️ وضعیت نامشخص' };
  }
}

// تبدیل تاریخ میلادی به شمسی
function gregorianToJalali(date) {
  let gy = date.getFullYear();
  let gm = date.getMonth() + 1;
  let gd = date.getDate();
  
  let g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy = (gy <= 1600) ? gy - 621 : gy - 1600;
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + 
             (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 365) days = (days - 1) % 365;
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  
  return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;
}

// محاسبه روزهای باقیمانده
function getDaysLeft(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

async function main() {
  // خواندن داده‌های قبلی
  const dataDir = './data';
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  
  const historyFile = `${dataDir}/history.json`;
  let history = [];
  if (fs.existsSync(historyFile)) {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  }
  
  const currentTime = new Date().toISOString();
  const currentCheck = {
    timestamp: currentTime,
    services: []
  };
  
  // بررسی هر سرویس
  for (const service of SERVICES) {
    console.log(`Checking ${service.name}...`);
    const response = await fetchUrl(service.url);
    const statusInfo = detectStatus(response);
    
    const serviceData = {
      name: service.name,
      url: service.url,
      status: statusInfo.status,
      message: statusInfo.message,
      responseTime: response.responseTime,
      httpStatus: response.statusCode,
      timestamp: currentTime,
      renewalDate: service.renewalDate,
      renewalDateJalali: service.renewalDate ? gregorianToJalali(new Date(service.renewalDate)) : 'نامحدود',
      daysLeft: getDaysLeft(service.renewalDate)
    };
    
    currentCheck.services.push(serviceData);
  }
  
  // ذخیره تاریخچه (فقط 1000 رکورد آخر)
  history.push(currentCheck);
  if (history.length > 1000) history = history.slice(-1000);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  
  // محاسبه آمار uptime
  const stats = calculateStats(history, SERVICES);
  fs.writeFileSync(`${dataDir}/stats.json`, JSON.stringify(stats, null, 2));
  
  // بروزرسانی README برای نمایش وضعیت
  updateReadme(currentCheck, stats);
  
  console.log('Check completed!');
}

function calculateStats(history, services) {
  const stats = {};
  
  for (const service of services) {
    const serviceHistory = history.flatMap(h => 
      h.services.filter(s => s.name === service.name)
    );
    
    if (serviceHistory.length === 0) continue;
    
    const total = serviceHistory.length;
    const active = serviceHistory.filter(h => h.status === 'active').length;
    const heavy = serviceHistory.filter(h => h.status === 'heavy').length;
    const inactive = serviceHistory.filter(h => h.status === 'inactive').length;
    
    // محاسبه uptime (فقط active / total)
    const uptimePercent = ((active / total) * 100).toFixed(2);
    
    // میانگین زمان پاسخ
    const avgResponseTime = Math.round(
      serviceHistory.reduce((sum, h) => sum + h.responseTime, 0) / total
    );
    
    // آخرین اختلال
    const lastOutage = serviceHistory
      .filter(h => h.status === 'inactive')
      .pop();
    
    // لیست اختلالات (24 ساعت اخیر)
    const last24h = serviceHistory.filter(h => {
      const checkTime = new Date(h.timestamp);
      const now = new Date();
      return (now - checkTime) < 24 * 60 * 60 * 1000;
    });
    
    stats[service.name] = {
      uptimePercent,
      avgResponseTime,
      totalChecks: total,
      active,
      heavy,
      inactive,
      lastOutage: lastOutage ? lastOutage.timestamp : null,
      last24h: {
        uptime: ((last24h.filter(h => h.status === 'active').length / last24h.length) * 100).toFixed(2),
        outages: last24h.filter(h => h.status === 'inactive').length
      }
    };
  }
  
  return stats;
}

function updateReadme(currentCheck, stats) {
  let readme = `# 📊 داشبورد مانیتورینگ سرویس‌ها
  
![Last Check](https://img.shields.io/badge/Last%20Check-${encodeURIComponent(new Date().toLocaleString('fa-IR'))}-blue)
  
## 🎯 وضعیت فعلی سرویس‌ها
  
`;
  
  for (const service of currentCheck.services) {
    const statusEmoji = service.status === 'active' ? '🟢' : 
                       service.status === 'heavy' ? '🟡' : '🔴';
    const statusText = service.status === 'active' ? 'فعال' : 
                      service.status === 'heavy' ? 'سنگینی بار' : 'غیرفعال';
    
    readme += `### ${statusEmoji} ${service.name}\n\n`;
    readme += `- **وضعیت:** ${statusText}\n`;
    readme += `- **پیام:** ${service.message}\n`;
    readme += `- **زمان پاسخ:** ${service.responseTime}ms\n`;
    readme += `- **تاریخ تمدید:** ${service.renewalDateJalali} ${service.daysLeft !== null ? `(${service.daysLeft} روز مانده)` : ''}\n\n`;
    
    if (stats[service.name]) {
      const s = stats[service.name];
      readme += `<details>\n<summary>📈 آمار عملکرد</summary>\n\n`;
      readme += `- **Uptime کلی:** ${s.uptimePercent}%\n`;
      readme += `- **میانگین زمان پاسخ:** ${s.avgResponseTime}ms\n`;
      readme += `- **تعداد بررسی‌ها:** ${s.totalChecks}\n`;
      readme += `- **اختلالات ۲۴ ساعت اخیر:** ${s.last24h.outages}\n`;
      readme += `</details>\n\n`;
    }
    
    readme += '---\n\n';
  }
  
  readme += `\n\n## 📉 نمودار Uptime (24 ساعت اخیر)\n\n`;
  
  // ساخت نمودار ASCII ساده
  for (const [serviceName, serviceStats] of Object.entries(stats)) {
    readme += `\n### ${serviceName}\n\`\`\`\n`;
    const serviceHistory = currentCheck.services.find(s => s.name === serviceName);
    if (serviceHistory) {
      const barLength = 20;
      const uptimeBar = Math.round((parseFloat(serviceStats.uptimePercent) / 100) * barLength);
      const bar = '█'.repeat(uptimeBar) + '░'.repeat(barLength - uptimeBar);
      readme += `${bar} ${serviceStats.uptimePercent}%\n`;
      readme += `0%${' '.repeat(18)}100%\n`;
    }
    readme += `\`\`\`\n`;
  }
  
  readme += `\n\n⏰ آخرین بروزرسانی: ${new Date().toLocaleString('fa-IR')}`;
  
  fs.writeFileSync('./README.md', readme);
}

main().catch(console.error);
