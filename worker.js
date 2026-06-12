// ==========================================
// Cloudflare Worker - Server Monitoring Panel
// ==========================================

// تنظیمات محیطی (از Secrets/Variables در Cloudflare Dashboard تنظیم شوند)
// ADMIN_PASSWORD: رمز عبور پنل ادمین
// GITHUB_DATA_URL: URL فایل data.json از گیت‌هاب (اختیاری برای مهاجرت)

// ==========================================
// توابع کمکی
// ==========================================

// تبدیل تاریخ میلادی به شمسی
function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { year: jy, month: jm, day: jd };
}

// فرمت کردن تاریخ شمسی
function formatPersianDate(date) {
    const jalali = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const toPersianDigits = (n) => n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    return `${toPersianDigits(jalali.year)}/${toPersianDigits(jalali.month)}/${toPersianDigits(jalali.day)}`;
}

// فرمت کردن زمان فارسی
function formatPersianTime(date) {
    const toPersianDigits = (n) => n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${toPersianDigits(hours)}:${toPersianDigits(minutes)}`;
}

// محاسبه روزهای باقی‌مانده تا تاریخ شمسی
function calculateDaysRemaining(persianDateStr) {
    if (!persianDateStr || persianDateStr.toLowerCase().includes('نامحدود') || persianDateStr === 'نامحدود') {
        return null;
    }
    
    try {
        const parts = persianDateStr.split('/').map(p => parseInt(p.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
        if (parts.length !== 3) return null;
        
        const [pYear, pMonth, pDay] = parts;
        
        // تبدیل تاریخ شمسی به میلادی
        function jalaliToGregorian(jy, jm, jd) {
            let gy = (jy <= 979) ? 621 : 1600;
            jy -= (jy <= 979) ? 0 : 979;
            let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
            gy += 400 * Math.floor(days / 146097);
            days %= 146097;
            if (days > 36524) {
                days--;
                gy += 100 * Math.floor(days / 36524);
                days %= 36524;
                if (days >= 365) days++;
            }
            gy += 4 * Math.floor(days / 1461);
            days %= 1461;
            gy += Math.floor((days - 1) / 365);
            if (days > 365) days = (days - 1) % 365;
            let gd = days + 1;
            const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            for (let i = 0; i < 13 && gd > sal_a[i]; i++) {
                gd -= sal_a[i];
            }
            const gm = i;
            return { year: gy, month: gm, day: gd };
        }
        
        const gregorianDate = jalaliToGregorian(pYear, pMonth, pDay);
        const targetDate = new Date(gregorianDate.year, gregorianDate.month - 1, gregorianDate.day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);
        
        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    } catch (e) {
        console.error('Error calculating days remaining:', e);
        return null;
    }
}

// تعیین وضعیت بر اساس محتوای پاسخ
function getStatus(content, statusCode) {
    if (statusCode >= 500) return 'inactive';
    if (!content) return 'inactive';
    
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('panel') || lowerContent.includes('dashboard') || lowerContent.includes('login')) {
        return 'active';
    } else if (lowerContent.includes('rate') || lowerContent.includes('1027') || lowerContent.includes('too many')) {
        return 'high_load';
    } else if (statusCode === 200 || statusCode === 301 || statusCode === 302) {
        return 'active';
    }
    
    return 'inactive';
}

// تولید پیام بر اساس وضعیت
function getMessage(status) {
    switch (status) {
        case 'active':
            return 'تبریک! سرویس شما با موفقیت در حال فعالیت است.';
        case 'high_load':
            return 'سنگینی بار روی سرور. نگران نباشید، تا ساعت ۳:۳۰ تا ۴ بامداد به وقت ایران منتظر بمانید.';
        default:
            return 'سرویس غیرفعال است. لطفاً به پشتیبانی مراجعه کنید.';
    }
}

// ==========================================
// هندلر اصلی Worker
// ==========================================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // CORS headers برای درخواست‌های frontend
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
        
        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        
        try {
            // روت‌های API
            if (path.startsWith('/api/')) {
                return await handleApiRequest(request, env, corsHeaders);
            }
            
            // روت اصلی - سرو کردن HTML
            if (path === '/' || path === '/index.html') {
                return serveFrontend(env);
            }
            
            // روت‌های دیگر
            return new Response('Not Found', { status: 404, headers: corsHeaders });
            
        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
    },
    
    // Scheduled event handler برای چک کردن ساعتی
    async scheduled(event, env, ctx) {
        console.log('Running scheduled check at:', new Date().toISOString());
        await checkAllServices(env);
    }
};

// ==========================================
// API Handlers
// ==========================================

async function handleApiRequest(request, env, corsHeaders) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // دریافت داده‌ها
    if (path === '/api/data' && request.method === 'GET') {
        return await getData(env, corsHeaders);
    }
    
    // تست لحظه‌ای یک دامنه
    if (path === '/api/test-domain' && request.method === 'POST') {
        return await testDomain(request, env, corsHeaders);
    }
    
    // احراز هویت ادمین
    if (path === '/api/admin/login' && request.method === 'POST') {
        return await adminLogin(request, env, corsHeaders);
    }
    
    // دریافت لیست سرورها (نیاز به احراز هویت)
    if (path === '/api/admin/servers' && request.method === 'GET') {
        return await getServers(request, env, corsHeaders);
    }
    
    // افزودن سرور جدید (نیاز به احراز هویت)
    if (path === '/api/admin/servers' && request.method === 'POST') {
        return await addServer(request, env, corsHeaders);
    }
    
    // بروزرسانی سرور (نیاز به احراز هویت)
    if (path === '/api/admin/servers' && request.method === 'PUT') {
        return await updateServer(request, env, corsHeaders);
    }
    
    // حذف سرور (نیاز به احراز هویت)
    if (path === '/api/admin/servers' && request.method === 'DELETE') {
        return await deleteServer(request, env, corsHeaders);
    }
    
    // چک کردن فوری همه سرورها (نیاز به احراز هویت)
    if (path === '/api/admin/check-all' && request.method === 'POST') {
        return await checkAllServices(env).then(() => 
            new Response(JSON.stringify({ success: true, message: 'بررسی با موفقیت انجام شد' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            })
        );
    }
    
    // دریافت آمار و تاریخچه
    if (path === '/api/history' && request.method === 'GET') {
        return await getHistory(env, corsHeaders);
    }
    
    return new Response('Not Found', { status: 404, headers: corsHeaders });
}

// ==========================================
// Data Management Functions
// ==========================================

async function getData(env, corsHeaders) {
    try {
        // خواندن داده‌ها از KV Storage
        let data = await env.MONITOR_DATA.get('current_data', { type: 'json' });
        
        if (!data) {
            // داده اولیه اگر وجود نداشته باشد
            data = {
                last_update: formatPersianDate(new Date()) + ' ' + formatPersianTime(new Date()),
                services: [],
                history: []
            };
        }
        
        return new Response(JSON.stringify(data, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    } catch (error) {
        console.error('Error getting data:', error);
        return new Response(JSON.stringify({ error: 'Failed to get data' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

async function getHistory(env, corsHeaders) {
    try {
        const history = await env.MONITOR_DATA.get('history', { type: 'json' }) || [];
        return new Response(JSON.stringify(history, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to get history' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

// ==========================================
// Domain Testing Functions
// ==========================================

async function testDomain(request, env, corsHeaders) {
    try {
        const { domain } = await request.json();
        
        if (!domain) {
            return new Response(JSON.stringify({ error: 'دامنه مشخص نشده است' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        const startTime = Date.now();
        let content = '';
        let statusCode = 0;
        let status = 'inactive';
        let message = '';
        let responseTime = 0;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(domain, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)'
                },
                signal: controller.signal,
                redirect: 'follow'
            });
            
            clearTimeout(timeoutId);
            statusCode = response.status;
            content = await response.text();
            responseTime = Date.now() - startTime;
            
            status = getStatus(content, statusCode);
            message = getMessage(status);
            
        } catch (fetchError) {
            responseTime = Date.now() - startTime;
            status = 'inactive';
            message = `خطا در اتصال: ${fetchError.message}`;
        }
        
        const result = {
            domain,
            status,
            statusCode,
            message,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
        };
        
        return new Response(JSON.stringify(result, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: 'خطا در تست دامنه' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

// ==========================================
// Admin Authentication
// ==========================================

async function adminLogin(request, env, corsHeaders) {
    try {
        const { password } = await request.json();
        
        if (!env.ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ error: 'رمز عبور ادمین تنظیم نشده است' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        if (password === env.ADMIN_PASSWORD) {
            // ایجاد توکن ساده (در محیط production بهتر است از JWT استفاده شود)
            const token = btoa(JSON.stringify({ 
                authenticated: true, 
                timestamp: Date.now(),
                expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            }));
            
            return new Response(JSON.stringify({ success: true, token }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        return new Response(JSON.stringify({ error: 'رمز عبور اشتباه است' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: 'خطا در احراز هویت' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

// بررسی اعتبار توکن
function verifyToken(token) {
    try {
        const decoded = JSON.parse(atob(token));
        if (!decoded.authenticated || !decoded.expires) return false;
        if (Date.now() > decoded.expires) return false;
        return true;
    } catch {
        return false;
    }
}

// استخراج توکن از هدر
function getTokenFromRequest(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return null;
}

// ==========================================
// Server Management (Admin Only)
// ==========================================

async function getServers(request, env, corsHeaders) {
    try {
        const token = getTokenFromRequest(request);
        if (!token || !verifyToken(token)) {
            return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        const servers = await env.MONITOR_DATA.get('servers', { type: 'json' }) || [];
        
        return new Response(JSON.stringify({ success: true, servers }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: 'خطا در دریافت سرورها' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

async function addServer(request, env, corsHeaders) {
    try {
        const token = getTokenFromRequest(request);
        if (!token || !verifyToken(token)) {
            return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        const body = await request.json();
        const { name, url, renewal_date, color } = body;
        
        if (!name || !url) {
            return new Response(JSON.stringify({ error: 'نام و URL الزامی هستند' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        const servers = await env.MONITOR_DATA.get('servers', { type: 'json' }) || [];
        
        const newServer = {
            id: Date.now().toString(),
            name,
            url,
            renewal_date: renewal_date || 'نامحدود',
            color: color || '#C7A46C',
            created_at: new Date().toISOString()
        };
        
        servers.push(newServer);
        
        await env.MONITOR_DATA.put('servers', JSON.stringify(servers));
        
        // چک کردن فوری سرور جدید
        await checkSingleService(newServer, env);
        
        return new Response(JSON.stringify({ success: true, server: newServer }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: 'خطا در افزودن سرور' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

async function updateServer(request, env, corsHeaders) {
    try {
        const token = getTokenFromRequest(request);
        if (!token || !verifyToken(token)) {
            return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        const body = await request.json();
        const { id, name, url, renewal_date, color } = body;
        
        if (!id) {
            return new Response(JSON.stringify({ error: 'شناسه سرور الزامی است' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        const servers = await env.MONITOR_DATA.get('servers', { type: 'json' }) || [];
        const index = servers.findIndex(s => s.id === id);
        
        if (index === -1) {
            return new Response(JSON.stringify({ error: 'سرور یافت نشد' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        if (name) servers[index].name = name;
        if (url) servers[index].url = url;
        if (renewal_date) servers[index].renewal_date = renewal_date;
        if (color) servers[index].color = color;
        servers[index].updated_at = new Date().toISOString();
        
        await env.MONITOR_DATA.put('servers', JSON.stringify(servers));
        
        // چک کردن فوری سرور بروزرسانی شده
        await checkSingleService(servers[index], env);
        
        return new Response(JSON.stringify({ success: true, server: servers[index] }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: 'خطا در بروزرسانی سرور' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

async function deleteServer(request, env, corsHeaders) {
    try {
        const token = getTokenFromRequest(request);
        if (!token || !verifyToken(token)) {
            return new Response(JSON.stringify({ error: 'دسترسی غیرمجاز' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        
        if (!id) {
            return new Response(JSON.stringify({ error: 'شناسه سرور الزامی است' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        const servers = await env.MONITOR_DATA.get('servers', { type: 'json' }) || [];
        const filteredServers = servers.filter(s => s.id !== id);
        
        if (filteredServers.length === servers.length) {
            return new Response(JSON.stringify({ error: 'سرور یافت نشد' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
        
        await env.MONITOR_DATA.put('servers', JSON.stringify(filteredServers));
        
        return new Response(JSON.stringify({ success: true, message: 'سرور حذف شد' }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: 'خطا در حذف سرور' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}

// ==========================================
// Service Checking Logic
// ==========================================

async function checkAllServices(env) {
    try {
        const servers = await env.MONITOR_DATA.get('servers', { type: 'json' }) || [];
        
        if (servers.length === 0) {
            console.log('No servers configured');
            return;
        }
        
        const servicesData = [];
        const historyEntry = [];
        
        const now = new Date();
        const lastUpdateStr = formatPersianDate(now) + ' ' + formatPersianTime(now);
        
        // چک کردن همه سرورها به صورت موازی
        const checkPromises = servers.map(server => checkSingleService(server, env));
        const results = await Promise.allSettled(checkPromises);
        
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const server = servers[i];
            
            if (result.status === 'fulfilled' && result.value) {
                const serviceInfo = result.value;
                servicesData.push(serviceInfo);
                
                historyEntry.push({
                    timestamp: now.toISOString(),
                    time_label: formatPersianTime(now),
                    service_name: server.name,
                    status: serviceInfo.status
                });
            } else {
                // خطا در چک کردن سرور
                servicesData.push({
                    name: server.name,
                    status: 'inactive',
                    renewal_date: server.renewal_date,
                    days_remaining: calculateDaysRemaining(server.renewal_date),
                    message: 'خطا در بررسی سرور',
                    url: server.url
                });
                
                historyEntry.push({
                    timestamp: now.toISOString(),
                    time_label: formatPersianTime(now),
                    service_name: server.name,
                    status: 'inactive'
                });
            }
        }
        
        // دریافت تاریخچه قبلی
        const existingHistory = await env.MONITOR_DATA.get('history', { type: 'json' }) || [];
        
        // ادغام و محدود کردن تاریخچه (نگهداری 4500 رکورد آخر)
        const newHistory = [...existingHistory, ...historyEntry];
        const HISTORY_LENGTH = 4500;
        const trimmedHistory = newHistory.length > HISTORY_LENGTH 
            ? newHistory.slice(-HISTORY_LENGTH) 
            : newHistory;
        
        // ساخت داده نهایی
        const finalData = {
            last_update: lastUpdateStr,
            services: servicesData,
            history: trimmedHistory
        };
        
        // ذخیره در KV
        await env.MONITOR_DATA.put('current_data', JSON.stringify(finalData));
        await env.MONITOR_DATA.put('history', JSON.stringify(trimmedHistory));
        
        console.log('All services checked successfully at:', lastUpdateStr);
        
    } catch (error) {
        console.error('Error checking all services:', error);
    }
}

async function checkSingleService(server, env) {
    try {
        const startTime = Date.now();
        let content = '';
        let statusCode = 0;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(server.url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; MonitorBot/1.0)'
            },
            signal: controller.signal,
            redirect: 'follow'
        });
        
        clearTimeout(timeoutId);
        statusCode = response.status;
        content = await response.text();
        
        const status = getStatus(content, statusCode);
        const message = getMessage(status);
        const daysRemaining = calculateDaysRemaining(server.renewal_date);
        
        const serviceInfo = {
            name: server.name,
            status,
            renewal_date: server.renewal_date,
            days_remaining: daysRemaining,
            message,
            url: server.url,
            color: server.color,
            response_time: Date.now() - startTime
        };
        
        return serviceInfo;
        
    } catch (error) {
        console.error(`Error checking ${server.name}:`, error);
        return {
            name: server.name,
            status: 'inactive',
            renewal_date: server.renewal_date,
            days_remaining: calculateDaysRemaining(server.renewal_date),
            message: `خطا: ${error.message}`,
            url: server.url,
            color: server.color
        };
    }
}

// ==========================================
// Frontend Serving
// ==========================================

async function serveFrontend(env) {
    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>پنل مانیتورینگ وضعیت سرورها</title>
    
    <!-- Fonts -->
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style>
        :root {
            --bg-color: #1E1E1E;
            --primary-color: #C7A46C;
            --text-color: #E0E0E0;
            --card-bg: #2D2D2D;
            --success-color: #4CAF50;
            --warning-color: #FFC107;
            --danger-color: #F44336;
            --info-color: #2196F3;
            --glass-bg: rgba(45, 45, 45, 0.6);
            --glass-border: rgba(199, 164, 108, 0.15);
            --glass-blur: 12px;
            --glow-shadow: 0 0 20px rgba(199, 164, 108, 0.1);
            --card-hover-shadow: 0 15px 35px rgba(0,0,0,0.4);
            --transition-speed: 0.3s;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Vazirmatn', sans-serif;
            outline: none;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            min-height: 100vh;
            position: relative;
            overflow-x: hidden;
            line-height: 1.6;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                linear-gradient(rgba(199, 164, 108, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(199, 164, 108, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
            z-index: -1;
            pointer-events: none;
        }
        
        body::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, transparent 0%, var(--bg-color) 90%);
            z-index: -1;
            pointer-events: none;
        }

        .container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            text-align: center;
            padding: 40px 0 20px;
            margin-bottom: 40px;
            position: relative;
        }

        header::after {
            content: '';
            display: block;
            width: 60px;
            height: 4px;
            background: var(--primary-color);
            margin: 15px auto 0;
            border-radius: 2px;
            box-shadow: 0 0 10px var(--primary-color);
        }

        h1 {
            color: var(--text-color);
            font-size: 2.2rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            text-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }
        
        h1 span {
            color: var(--primary-color);
        }

        .last-update {
            display: inline-block;
            margin-top: 15px;
            padding: 5px 15px;
            background: rgba(199, 164, 108, 0.1);
            border: 1px solid var(--glass-border);
            border-radius: 50px;
            font-size: 0.85rem;
            color: var(--primary-color);
            position: relative;
            overflow: hidden;
        }
        
        .last-update::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(199, 164, 108, 0.2), transparent);
            transform: translateX(100%);
            animation: shimmer 3s infinite;
        }

        .info-box {
            background: rgba(30, 30, 30, 0.8);
            border-right: 4px solid var(--primary-color);
            border-radius: 8px;
            padding: 20px 25px;
            margin-bottom: 30px;
            font-size: 0.9rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-items: center;
            justify-content: space-between;
            backdrop-filter: blur(5px);
        }

        .info-content h3 {
            color: var(--primary-color);
            margin-bottom: 8px;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .info-content ul {
            list-style: none;
        }

        .info-content li {
            margin-bottom: 6px;
            position: relative;
            padding-right: 15px;
            color: #ccc;
        }
        
        .info-content li::before {
            content: '•';
            color: var(--primary-color);
            position: absolute;
            right: 0;
            font-size: 1.2rem;
            line-height: 1.4rem;
        }

        .alert-note {
            background: rgba(255, 193, 7, 0.05);
            padding: 10px 15px;
            border-radius: 6px;
            border: 1px dashed var(--warning-color);
            color: #ddd;
            font-size: 0.85rem;
            flex: 1;
            min-width: 250px;
        }

        /* دکمه‌های کنترل */
        .control-panel {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
            justify-content: center;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: bold;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary-color), #A68B5A);
            color: #fff;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(199, 164, 108, 0.4);
        }

        .btn-success {
            background: linear-gradient(135deg, var(--success-color), #3D8B40);
            color: #fff;
        }

        .btn-warning {
            background: linear-gradient(135deg, var(--warning-color), #CCA300);
            color: #000;
        }

        .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 25px;
            margin-bottom: 60px;
        }

        .service-card {
            background: var(--glass-bg);
            backdrop-filter: blur(var(--glass-blur));
            -webkit-backdrop-filter: blur(var(--glass-blur));
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 25px;
            position: relative;
            overflow: hidden;
            transition: all var(--transition-speed) cubic-bezier(0.25, 0.8, 0.25, 1);
            animation: fadeInUp 0.6s ease backwards;
        }

        .service-card::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 4px;
            height: 100%;
            background: #555;
            transition: background 0.3s ease;
        }

        .service-card:hover {
            transform: translateY(-8px) scale(1.01);
            box-shadow: var(--card-hover-shadow), var(--glow-shadow);
            border-color: rgba(199, 164, 108, 0.4);
            background: rgba(45, 45, 45, 0.85);
        }

        .service-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }

        .service-name {
            font-size: 1.3rem;
            font-weight: 700;
            color: #fff;
            position: relative;
            z-index: 1;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 50px;
            font-size: 0.8rem;
            font-weight: bold;
            color: #000;
            background: #444;
            transition: all 0.3s ease;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: currentColor;
            box-shadow: 0 0 8px currentColor;
        }
        
        .pulse { animation: pulse-anim 2s infinite; }

        @keyframes pulse-anim {
            0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); }
            70% { box-shadow: 0 0 0 6px rgba(76, 175, 80, 0); }
            100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
        }

        .status-active { background: rgba(76, 175, 80, 0.15); color: var(--success-color); border: 1px solid rgba(76, 175, 80, 0.3); }
        .status-high-load { background: rgba(255, 193, 7, 0.15); color: var(--warning-color); border: 1px solid rgba(255, 193, 7, 0.3); }
        .status-inactive { background: rgba(244, 67, 54, 0.15); color: var(--danger-color); border: 1px solid rgba(244, 67, 54, 0.3); }

        .service-message {
            margin-bottom: 25px;
            font-size: 0.95rem;
            color: #ccc;
            min-height: 45px;
            border-right: 2px solid rgba(255,255,255,0.05);
            padding-right: 10px;
        }

        .renewal-info {
            background: rgba(0,0,0,0.3);
            padding: 15px;
            border-radius: 12px;
        }

        .renewal-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.85rem;
            color: #aaa;
            margin-bottom: 8px;
        }

        .progress-container {
            width: 100%;
            height: 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
            overflow: hidden;
            position: relative;
        }

        .progress-bar {
            height: 100%;
            border-radius: 3px;
            width: 0%;
            transition: width 1s ease-in-out, background-color 0.3s ease;
            position: relative;
        }
        
        .progress-bar::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            transform: translateX(-100%);
            animation: progressShine 2s infinite;
        }

        .days-remaining-text {
            margin-top: 8px;
            text-align: left;
            font-size: 0.9rem;
            font-weight: bold;
        }

        .charts-section {
            margin-top: 80px;
        }

        .section-title {
            color: var(--primary-color);
            margin-bottom: 40px;
            font-size: 1.8rem;
            position: relative;
            text-align: center;
            width: 100%;
        }
        
        .section-title::after {
            content: '';
            display: block;
            width: 40px;
            height: 3px;
            background: var(--text-color);
            margin: 10px auto 0;
            opacity: 0.3;
        }

        @media (max-width: 576px) {
            .section-title {
                font-size: 1.4rem;
            }
            h1 {
                font-size: 1.8rem;
            }
        }

        .charts-container {
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
        }

        @media (min-width: 992px) {
            .charts-container {
                grid-template-columns: 1fr 1fr;
            }
        }

        .chart-card {
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            position: relative;
            height: 350px;
        }

        .chart-card h3 {
            color: var(--text-color);
            margin-bottom: 25px;
            text-align: center;
            font-weight: 600;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            padding-bottom: 15px;
            font-size: 1.1rem;
        }

        .chart-card canvas {
            height: 250px !important;
            width: 100% !important;
        }

        #loading {
            grid-column: 1 / -1;
            text-align: center;
            padding: 50px;
            color: var(--primary-color);
            font-size: 1.2rem;
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(199, 164, 108, 0.1);
            border-top: 4px solid var(--primary-color);
            border-radius: 50%;
            margin: 0 auto 15px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes shimmer { 100% { transform: translateX(-100%); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .text-yellow { color: var(--warning-color); }
        .text-orange { color: #FF9800; }
        .text-red { color: var(--danger-color); }
        .text-green { color: var(--success-color); }

        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }

        .modal.active {
            display: flex;
        }

        .modal-content {
            background: var(--card-bg);
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .modal-close {
            background: none;
            border: none;
            color: var(--text-color);
            font-size: 1.5rem;
            cursor: pointer;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--primary-color);
        }

        .form-group input, .form-group select {
            width: 100%;
            padding: 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--glass-border);
            border-radius: 8px;
            color: var(--text-color);
            font-size: 1rem;
        }

        .form-group input:focus {
            border-color: var(--primary-color);
        }

        /* Test Domain Section */
        .test-domain-box {
            background: rgba(30, 30, 30, 0.8);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
        }

        .test-result {
            margin-top: 15px;
            padding: 15px;
            border-radius: 8px;
            display: none;
        }

        .test-result.show {
            display: block;
        }

        .test-result.active {
            background: rgba(76, 175, 80, 0.1);
            border: 1px solid var(--success-color);
        }

        .test-result.inactive {
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid var(--danger-color);
        }

        .test-result.high_load {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid var(--warning-color);
        }

        /* Admin Panel */
        .admin-panel {
            background: rgba(30, 30, 30, 0.9);
            border: 1px solid var(--primary-color);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
        }

        .server-list {
            margin-top: 20px;
        }

        .server-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            margin-bottom: 10px;
        }

        .server-actions {
            display: flex;
            gap: 10px;
        }

        .btn-sm {
            padding: 8px 16px;
            font-size: 0.85rem;
        }
    </style>
</head>
<body>

    <div class="container">
        <header>
            <h1>داشبورد مانیتورینگ <span>سرورها</span></h1>
            <div class="last-update" id="lastUpdate">در حال همگام‌سازی...</div>
        </header>

        <div class="info-box">
            <div class="info-content">
                <h3>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    راهنمای وضعیت سرویس‌ها
                </h3>
                <ul>
                    <li><strong class="text-green">فعال:</strong> سرویس پایدار و در حال اجرا.</li>
                    <li><strong class="text-yellow">سنگینی بار:</strong> محدودیت ترافیکی ساعت ۳:۳۰ تا ۴ بامداد ریست می‌شود.</li>
                    <li><strong class="text-red">غیرفعال:</strong> نیاز به بررسی پشتیبانی فنی.</li>
                </ul>
            </div>
            <div class="alert-note">
                🛡️ <strong>تضمین سرویس:</strong> در صورت قطعی یا اختلال سیستماتیک، روزهای از دست رفته به پایان اعتبار شما اضافه خواهد شد.
            </div>
        </div>

        <!-- Control Panel -->
        <div class="control-panel">
            <button class="btn btn-primary" onclick="openTestModal()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                تست دامنه
            </button>
            <button class="btn btn-success" onclick="refreshData()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><polyline points="20.49 15 20.49 10 23 10"></polyline><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path></svg>
                بروزرسانی
            </button>
            <button class="btn btn-warning" onclick="openAdminModal()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                پنل ادمین
            </button>
        </div>

        <!-- Test Domain Box -->
        <div class="test-domain-box" id="testDomainBox" style="display: none;">
            <h3 style="color: var(--primary-color); margin-bottom: 15px;">🔍 تست لحظه‌ای دامنه</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <input type="text" id="testDomainInput" placeholder="https://example.com" style="flex: 1; min-width: 250px; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 8px; color: var(--text-color);">
                <button class="btn btn-primary" onclick="testDomain()">تست کن</button>
            </div>
            <div id="testResult" class="test-result"></div>
        </div>

        <div id="servicesContainer" class="services-grid">
            <div id="loading">
                <div class="spinner"></div>
                در حال ارتباط با سرورها...
            </div>
        </div>

        <div class="charts-section">
            <h2 class="section-title">تحلیل و آمار عملکرد</h2>
            <div class="charts-container">
                <div class="chart-card">
                    <h3>📊 گزارش وضعیت ساعتی (آخرین روز)</h3>
                    <canvas id="hourlyChart"></canvas>
                </div>
                <div class="chart-card">
                    <h3>📈 گزارش وضعیت روزانه (ماه گذشته)</h3>
                    <canvas id="dailyChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <!-- Test Domain Modal -->
    <div class="modal" id="testModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 style="color: var(--primary-color);">تست دامنه</h2>
                <button class="modal-close" onclick="closeTestModal()">&times;</button>
            </div>
            <div class="form-group">
                <label>آدرس دامنه را وارد کنید:</label>
                <input type="text" id="modalDomainInput" placeholder="https://example.com">
            </div>
            <button class="btn btn-primary" style="width: 100%;" onclick="testDomainFromModal()">شروع تست</button>
            <div id="modalTestResult" class="test-result" style="margin-top: 20px;"></div>
        </div>
    </div>

    <!-- Admin Login Modal -->
    <div class="modal" id="adminLoginModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 style="color: var(--primary-color);">ورود به پنل ادمین</h2>
                <button class="modal-close" onclick="closeAdminLoginModal()">&times;</button>
            </div>
            <div class="form-group">
                <label>رمز عبور:</label>
                <input type="password" id="adminPassword" placeholder="رمز عبور را وارد کنید">
            </div>
            <button class="btn btn-primary" style="width: 100%;" onclick="adminLogin()">ورود</button>
        </div>
    </div>

    <!-- Admin Panel Modal -->
    <div class="modal" id="adminPanelModal">
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2 style="color: var(--primary-color);">پنل مدیریت سرورها</h2>
                <button class="modal-close" onclick="closeAdminPanelModal()">&times;</button>
            </div>
            
            <div class="admin-panel">
                <h3 style="color: var(--text-color); margin-bottom: 15px;">➕ افزودن سرور جدید</h3>
                <div class="form-group">
                    <label>نام سرور:</label>
                    <input type="text" id="newServerName" placeholder="مثلاً: سرویس مرکزی">
                </div>
                <div class="form-group">
                    <label>آدرس URL:</label>
                    <input type="text" id="newServerUrl" placeholder="https://example.com/login">
                </div>
                <div class="form-group">
                    <label>تاریخ تمدید (شمسی):</label>
                    <input type="text" id="newServerRenewal" placeholder="1405/12/21 یا نامحدود">
                </div>
                <div class="form-group">
                    <label>رنگ:</label>
                    <input type="color" id="newServerColor" value="#C7A46C" style="height: 50px;">
                </div>
                <button class="btn btn-success" style="width: 100%;" onclick="addNewServer()">افزودن سرور</button>
            </div>

            <div class="server-list" id="serverList">
                <h3 style="color: var(--text-color); margin-bottom: 15px;">📋 لیست سرورها</h3>
                <div id="serverListContent">در حال بارگذاری...</div>
            </div>
        </div>
    </div>

    <script>
        let adminToken = localStorage.getItem('adminToken');

        // تبدیل اعداد انگلیسی به فارسی
        function toPersianDigits(str) {
            if (!str && str !== 0) return '';
            return str.toString().replace(/\\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
        }

        // دریافت داده‌ها
        async function fetchData() {
            try {
                const response = await fetch('/api/data');
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                renderPage(data);
            } catch (error) {
                console.error('Error fetching data:', error);
                document.getElementById('servicesContainer').innerHTML = \`
                    <div style="grid-column: 1/-1; text-align:center; padding: 40px; background: rgba(244, 67, 54, 0.1); border: 1px solid var(--danger-color); border-radius: 12px;">
                        <p style="color: var(--danger-color); font-size: 1.1rem; margin-bottom: 10px;">⚠️ خطا در دریافت اطلاعات</p>
                        <p style="color: #ccc;">لطفاً اتصال اینترنت خود را بررسی کرده و مجدداً تلاش کنید.</p>
                    </div>
                \`;
            }
        }

        // بروزرسانی دستی
        async function refreshData() {
            const loadingDiv = document.getElementById('loading');
            loadingDiv.style.display = 'block';
            loadingDiv.innerHTML = '<div class="spinner"></div>در حال بروزرسانی...';
            document.getElementById('servicesContainer').appendChild(loadingDiv);
            
            try {
                const response = await fetch('/api/admin/check-all', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + adminToken
                    }
                });
                
                if (!response.ok && response.status !== 401) {
                    // بدون احراز هویت هم اجازه چک کردن می‌دهیم
                }
                
                await fetchData();
            } catch (error) {
                console.error('Error refreshing:', error);
            } finally {
                loadingDiv.style.display = 'none';
            }
        }

        function renderPage(data) {
            document.getElementById('lastUpdate').textContent = \`آخرین بروزرسانی: \${toPersianDigits(data.last_update)}\`;

            const container = document.getElementById('servicesContainer');
            container.innerHTML = '';

            if (!data.services || data.services.length === 0) {
                container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">هیچ سروری ثبت نشده است. از پنل ادمین سرور اضافه کنید.</p>';
                return;
            }

            data.services.forEach((service, index) => {
                const statusDetails = getStatusDetails(service.status);
                const delay = index * 100;

                let progressColor = '#4CAF50';
                let progressWidth = '0%';
                let daysClass = '';
                let daysText = toPersianDigits(service.days_remaining);

                if (service.days_remaining !== null) {
                    if (service.days_remaining < 0) {
                        daysClass = 'text-red';
                        daysText = \`\${toPersianDigits(Math.abs(service.days_remaining))} روز تاخیر\`;
                        progressColor = '#F44336';
                        progressWidth = '100%';
                    } else if (service.days_remaining <= 10) {
                        daysClass = service.days_remaining === 0 ? 'text-orange' : 'text-yellow';
                        progressColor = service.days_remaining === 0 ? '#FF9800' : '#FFC107';
                        progressWidth = '20%';
                    } else {
                        daysClass = 'text-green';
                        progressWidth = '80%';
                    }
                } else {
                    daysText = 'نامحدود';
                    daysClass = 'text-green';
                    progressColor = '#C7A46C';
                    progressWidth = '100%';
                }

                const card = document.createElement('div');
                card.className = 'service-card';
                card.style.animationDelay = \`\${delay}ms\`;
                card.style.borderRightColor = service.color || statusDetails.color;

                card.innerHTML = \`
                    <div class="service-header">
                        <span class="service-name">\${service.name}</span>
                        <div class="status-badge \${statusDetails.class}">
                            <span class="status-dot \${statusDetails.dotPulse ? 'pulse' : ''}" style="background-color: \${statusDetails.color}"></span>
                            \${statusDetails.text}
                        </div>
                    </div>
                    <div class="service-message">\${service.message}</div>
                    <div class="renewal-info">
                        <div class="renewal-header">
                            <span>تاریخ تمدید: \${toPersianDigits(service.renewal_date)}</span>
                            <span>\${service.days_remaining === null ? '' : 'وضعیت اعتبار'}</span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: \${progressWidth}; background-color: \${progressColor}; box-shadow: 0 0 10px \${progressColor}"></div>
                        </div>
                        <div class="days-remaining-text \${daysClass}" style="color: \${progressColor}">
                             \${service.days_remaining === null ? 'اعتبار نامحدود' : (service.days_remaining < 0 ? 'عقب افتاده: ' : 'باقی‌مانده: ')}\${daysText} روز
                        </div>
                    </div>
                \`;
                container.appendChild(card);
            });

            renderRealCharts(data.history || []);
        }

        function getStatusDetails(statusCode) {
            switch (statusCode) {
                case 'active': return { text: 'فعال', class: 'status-active', color: '#4CAF50', dotPulse: true };
                case 'high_load': return { text: 'سنگینی بار', class: 'status-high-load', color: '#FFC107', dotPulse: true };
                case 'inactive': return { text: 'غیرفعال', class: 'status-inactive', color: '#F44336', dotPulse: false };
                default: return { text: 'نامشخص', class: 'status-inactive', color: '#999', dotPulse: false };
            }
        }

        // تست دامنه
        function openTestModal() {
            document.getElementById('testModal').classList.add('active');
        }

        function closeTestModal() {
            document.getElementById('testModal').classList.remove('active');
            document.getElementById('modalTestResult').innerHTML = '';
            document.getElementById('modalTestResult').className = 'test-result';
        }

        function testDomainFromModal() {
            const domain = document.getElementById('modalDomainInput').value.trim();
            if (!domain) {
                alert('لطفاً آدرس دامنه را وارد کنید');
                return;
            }
            performTest(domain, 'modalTestResult');
        }

        async function performTest(domain, resultElementId) {
            const resultDiv = document.getElementById(resultElementId);
            resultDiv.innerHTML = '<div class="spinner" style="width: 30px; height: 30px; margin: 10px auto;"></div><p style="text-align: center;">در حال تست...</p>';
            resultDiv.className = 'test-result show';

            try {
                const response = await fetch('/api/test-domain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain })
                });
                
                const result = await response.json();
                
                if (result.error) {
                    resultDiv.innerHTML = \`<p style="color: var(--danger-color);">\${result.error}</p>\`;
                    resultDiv.className = 'test-result show inactive';
                    return;
                }

                const statusClass = result.status;
                const statusText = result.status === 'active' ? 'فعال' : result.status === 'high_load' ? 'سنگینی بار' : 'غیرفعال';

                resultDiv.innerHTML = \`
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong>وضعیت: <span style="color: \${getStatusDetails(result.status).color}">\${statusText}</span></strong>
                        <span>زمان پاسخ: \${result.responseTime}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #ccc;">\${result.message}</div>
                    <div style="font-size: 0.85rem; color: #888; margin-top: 10px;">کد وضعیت HTTP: \${result.statusCode}</div>
                \`;
                resultDiv.className = \`test-result show \${statusClass}\`;

            } catch (error) {
                resultDiv.innerHTML = \`<p style="color: var(--danger-color);">خطا: \${error.message}</p>\`;
                resultDiv.className = 'test-result show inactive';
            }
        }

        // Admin Functions
        function openAdminModal() {
            if (adminToken && verifyToken(adminToken)) {
                openAdminPanelModal();
            } else {
                document.getElementById('adminLoginModal').classList.add('active');
            }
        }

        function closeAdminLoginModal() {
            document.getElementById('adminLoginModal').classList.remove('active');
        }

        async function adminLogin() {
            const password = document.getElementById('adminPassword').value;
            if (!password) {
                alert('لطفاً رمز عبور را وارد کنید');
                return;
            }

            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const result = await response.json();

                if (result.success) {
                    adminToken = result.token;
                    localStorage.setItem('adminToken', adminToken);
                    closeAdminLoginModal();
                    document.getElementById('adminPassword').value = '';
                    openAdminPanelModal();
                } else {
                    alert(result.error || 'رمز عبور اشتباه است');
                }
            } catch (error) {
                alert('خطا در ورود: ' + error.message);
            }
        }

        function verifyToken(token) {
            try {
                const decoded = JSON.parse(atob(token));
                if (!decoded.authenticated || !decoded.expires) return false;
                if (Date.now() > decoded.expires) return false;
                return true;
            } catch {
                return false;
            }
        }

        function openAdminPanelModal() {
            document.getElementById('adminPanelModal').classList.add('active');
            loadServerList();
        }

        function closeAdminPanelModal() {
            document.getElementById('adminPanelModal').classList.remove('active');
        }

        async function loadServerList() {
            const listContent = document.getElementById('serverListContent');
            listContent.innerHTML = '<div class="spinner" style="width: 30px; height: 30px; margin: 10px auto;"></div>';

            try {
                const response = await fetch('/api/admin/servers', {
                    headers: { 'Authorization': 'Bearer ' + adminToken }
                });

                const result = await response.json();

                if (result.success && result.servers) {
                    if (result.servers.length === 0) {
                        listContent.innerHTML = '<p style="text-align: center; color: #888;">هیچ سروری ثبت نشده است</p>';
                        return;
                    }

                    listContent.innerHTML = result.servers.map(server => \`
                        <div class="server-item">
                            <div>
                                <strong style="color: \${server.color || 'var(--primary-color)'}">\${server.name}</strong>
                                <div style="font-size: 0.85rem; color: #888; margin-top: 5px;">\${server.url}</div>
                                <div style="font-size: 0.85rem; color: #aaa;">تمدید: \${server.renewal_date}</div>
                            </div>
                            <div class="server-actions">
                                <button class="btn btn-warning btn-sm" onclick="editServer('\${server.id}')">ویرایش</button>
                                <button class="btn" style="background: var(--danger-color); color: white;" class="btn-sm" onclick="deleteServer('\${server.id}')">حذف</button>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    listContent.innerHTML = '<p style="color: var(--danger-color); text-align: center;">خطا در بارگذاری سرورها</p>';
                }
            } catch (error) {
                listContent.innerHTML = '<p style="color: var(--danger-color); text-align: center;">خطا: ' + error.message + '</p>';
            }
        }

        async function addNewServer() {
            const name = document.getElementById('newServerName').value.trim();
            const url = document.getElementById('newServerUrl').value.trim();
            const renewal_date = document.getElementById('newServerRenewal').value.trim() || 'نامحدود';
            const color = document.getElementById('newServerColor').value;

            if (!name || !url) {
                alert('نام و URL الزامی هستند');
                return;
            }

            try {
                const response = await fetch('/api/admin/servers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + adminToken
                    },
                    body: JSON.stringify({ name, url, renewal_date, color })
                });

                const result = await response.json();

                if (result.success) {
                    alert('سرور با موفقیت افزوده شد');
                    document.getElementById('newServerName').value = '';
                    document.getElementById('newServerUrl').value = '';
                    document.getElementById('newServerRenewal').value = '';
                    loadServerList();
                    fetchData();
                } else {
                    alert(result.error || 'خطا در افزودن سرور');
                }
            } catch (error) {
                alert('خطا: ' + error.message);
            }
        }

        async function deleteServer(id) {
            if (!confirm('آیا مطمئن هستید که می‌خواهید این سرور را حذف کنید؟')) return;

            try {
                const response = await fetch('/api/admin/servers?id=' + id, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + adminToken }
                });

                const result = await response.json();

                if (result.success) {
                    alert('سرور حذف شد');
                    loadServerList();
                    fetchData();
                } else {
                    alert(result.error || 'خطا در حذف سرور');
                }
            } catch (error) {
                alert('خطا: ' + error.message);
            }
        }

        // Charts
        function renderRealCharts(history) {
            if (!history || history.length === 0) return;

            // Hourly chart
            const hourlyData = getHourlyChartData(history);
            const ctxHourly = document.getElementById('hourlyChart').getContext('2d');
            
            // Destroy existing chart if any
            if (window.hourlyChartInstance) window.hourlyChartInstance.destroy();

            window.hourlyChartInstance = new Chart(ctxHourly, {
                type: 'line',
                data: {
                    labels: hourlyData.labels,
                    datasets: hourlyData.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            align: 'end',
                            labels: { color: '#E0E0E0', font: { family: 'Vazirmatn', size: 12 }, usePointStyle: true, boxWidth: 8 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(30, 30, 30, 0.9)',
                            titleColor: '#C7A46C',
                            bodyColor: '#fff',
                            borderColor: 'rgba(199, 164, 108, 0.3)',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    const val = context.parsed.y;
                                    if (val === 2) label += 'فعال';
                                    else if (val === 1) label += 'سنگینی بار';
                                    else if (val === 0) label += 'غیرفعال';
                                    else label += 'نامشخص';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#888', font: { family: 'Vazirmatn' } },
                            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }
                        },
                        y: {
                            min: -0.2,
                            max: 2.2,
                            ticks: {
                                stepSize: 1,
                                color: '#888',
                                font: { family: 'Vazirmatn' },
                                callback: function(value) {
                                    if (value === 2) return 'فعال';
                                    if (value === 1) return 'سنگینی بار';
                                    if (value === 0) return 'غیرفعال';
                                    return '';
                                }
                            },
                            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }
                        }
                    }
                }
            });

            // Daily chart
            const dailyData = getDailyChartData(history);
            const ctxDaily = document.getElementById('dailyChart').getContext('2d');
            
            if (window.dailyChartInstance) window.dailyChartInstance.destroy();

            window.dailyChartInstance = new Chart(ctxDaily, {
                type: 'line',
                data: {
                    labels: dailyData.labels,
                    datasets: dailyData.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            align: 'end',
                            labels: { color: '#E0E0E0', font: { family: 'Vazirmatn', size: 12 }, usePointStyle: true, boxWidth: 8 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(30, 30, 30, 0.9)',
                            titleColor: '#C7A46C',
                            bodyColor: '#fff',
                            borderColor: 'rgba(199, 164, 108, 0.3)',
                            borderWidth: 1,
                            padding: 10,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    const val = context.parsed.y;
                                    if (val === 2) label += 'فعال';
                                    else if (val === 1) label += 'سنگینی بار';
                                    else if (val === 0) label += 'غیرفعال';
                                    else label += 'نامشخص';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#888', font: { family: 'Vazirmatn' } },
                            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }
                        },
                        y: {
                            min: -0.2,
                            max: 2.2,
                            ticks: {
                                stepSize: 1,
                                color: '#888',
                                font: { family: 'Vazirmatn' },
                                callback: function(value) {
                                    if (value === 2) return 'فعال';
                                    if (value === 1) return 'سنگینی بار';
                                    if (value === 0) return 'غیرفعال';
                                    return '';
                                }
                            },
                            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }
                        }
                    }
                }
            });
        }

        function getHourlyChartData(history) {
            if (!history || history.length === 0) return { labels: [], datasets: [] };

            const dates = history.map(h => h.timestamp.split('T')[0]);
            const latestDate = dates.sort().reverse()[0];
            const dayData = history.filter(h => h.timestamp.startsWith(latestDate));

            const hours = [...new Set(dayData.map(h => h.time_label))].sort((a, b) => a.localeCompare(b, 'fa', { numeric: true }));
            const statusMap = { 'inactive': 0, 'high_load': 1, 'active': 2 };

            const serviceStatusMap = {};
            dayData.forEach(entry => {
                if (!serviceStatusMap[entry.service_name]) serviceStatusMap[entry.service_name] = {};
                serviceStatusMap[entry.service_name][entry.time_label] = statusMap[entry.status];
            });

            const serviceNames = Object.keys(serviceStatusMap).sort();

            const datasets = serviceNames.map((serviceName, idx) => {
                const data = hours.map(hour => serviceStatusMap[serviceName][hour] ?? null);
                const colors = [
                    { bg: 'rgba(199, 164, 108, 0.5)', border: 'rgba(199, 164, 108, 1)' },
                    { bg: 'rgba(76, 175, 80, 0.5)', border: 'rgba(76, 175, 80, 1)' },
                    { bg: 'rgba(33, 150, 243, 0.5)', border: 'rgba(33, 150, 243, 1)' },
                    { bg: 'rgba(156, 39, 176, 0.5)', border: 'rgba(156, 39, 176, 1)' },
                    { bg: 'rgba(255, 152, 0, 0.5)', border: 'rgba(255, 152, 0, 1)' },
                    { bg: 'rgba(0, 188, 212, 0.5)', border: 'rgba(0, 188, 212, 1)' }
                ];
                const colorIndex = idx % colors.length;

                return {
                    label: serviceName,
                    data: data,
                    borderColor: colors[colorIndex].border,
                    backgroundColor: colors[colorIndex].bg,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    spanGaps: true
                };
            });

            const persianHours = hours.map(h => toPersianDigits(h));
            return { labels: persianHours, datasets };
        }

        function getDailyChartData(history) {
            if (!history || history.length === 0) return { labels: [], datasets: [] };

            function aggregateDailyStatus(statuses) {
                const counts = { inactive: 0, high_load: 0, active: 0 };
                statuses.forEach(s => counts[s]++);
                const maxCount = Math.max(counts.inactive, counts.high_load, counts.active);
                if (counts.inactive === maxCount) return 'inactive';
                if (counts.high_load === maxCount) return 'high_load';
                return 'active';
            }

            const statusMap = { 'inactive': 0, 'high_load': 1, 'active': 2 };

            const entriesByDateService = {};
            history.forEach(entry => {
                const date = entry.timestamp.split('T')[0];
                const key = \`\${date}|\${entry.service_name}\`;
                if (!entriesByDateService[key]) entriesByDateService[key] = [];
                entriesByDateService[key].push(entry.status);
            });

            const allDates = [...new Set(history.map(h => h.timestamp.split('T')[0]))].sort();
            const serviceNames = [...new Set(history.map(h => h.service_name))].sort();

            const datasets = serviceNames.map((serviceName, idx) => {
                const data = allDates.map(date => {
                    const key = \`\${date}|\${serviceName}\`;
                    if (entriesByDateService[key]) {
                        const dailyStatus = aggregateDailyStatus(entriesByDateService[key]);
                        return statusMap[dailyStatus];
                    }
                    return null;
                });

                const colors = [
                    { bg: 'rgba(199, 164, 108, 0.5)', border: 'rgba(199, 164, 108, 1)' },
                    { bg: 'rgba(76, 175, 80, 0.5)', border: 'rgba(76, 175, 80, 1)' },
                    { bg: 'rgba(33, 150, 243, 0.5)', border: 'rgba(33, 150, 243, 1)' },
                    { bg: 'rgba(156, 39, 176, 0.5)', border: 'rgba(156, 39, 176, 1)' },
                    { bg: 'rgba(255, 152, 0, 0.5)', border: 'rgba(255, 152, 0, 1)' },
                    { bg: 'rgba(0, 188, 212, 0.5)', border: 'rgba(0, 188, 212, 1)' }
                ];
                const colorIndex = idx % colors.length;

                return {
                    label: serviceName,
                    data: data,
                    borderColor: colors[colorIndex].border,
                    backgroundColor: colors[colorIndex].bg,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    spanGaps: false
                };
            });

            return { labels: allDates, datasets };
        }

        // Auto refresh every 5 minutes
        setInterval(fetchData, 5 * 60 * 1000);

        // Initial load
        fetchData();
    </script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}