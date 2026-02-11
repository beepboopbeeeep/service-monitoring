// تنظیمات اولیه
const CONFIG = {
    // برای اضافه کردن سرویس جدید، به سادگی یک آبجکت جدید به این آرایه اضافه کنید
    services: [
        {
            id: 'central',
            name: 'سرویس مرکزی',
            url: 'https://tellmeimright.taxyvy.workers.dev/panel',
            renewalDate: 'نامحدود',
            color: '#C7A46C'
        },
        {
            id: 'sultan',
            name: 'سرویس سلطان',
            url: 'https://hitmeintheyes.judiopu.workers.dev/panel',
            renewalDate: '1404/12/21',
            color: '#4CAF50'
        }
        // برای اضافه کردن سرویس جدید، خط زیر را کپی و ویرایش کنید:
        // {
        //     id: 'new-service',
        //     name: 'نام سرویس جدید',
        //     url: 'https://example.com/panel',
        //     renewalDate: '1404/12/30',
        //     color: '#2196F3'
        // }
    ],
    statusUrl: 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/status.json',
    historyUrl: 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/history.json',
    updateInterval: 600000 // 10 دقیقه
};

// متغیرهای global
let statusData = {};
let historyData = {};
let charts = {};

// تابع اصلی بارگذاری داده‌ها
async function loadData() {
    try {
        showLoading(true);
        
        // بارگذاری وضعیت فعلی
        const statusResponse = await fetch(`${CONFIG.statusUrl}?t=${Date.now()}`);
        statusData = await statusResponse.json();
        
        // بارگذاری تاریخچه
        const historyResponse = await fetch(`${CONFIG.historyUrl}?t=${Date.now()}`);
        historyData = await historyResponse.json();
        
        // به‌روزرسانی رابط کاربری
        updateLastUpdate();
        renderServices();
        renderCharts();
        
    } catch (error) {
        console.error('خطا در بارگذاری داده‌ها:', error);
        showError('خطا در ارتباط با سرور');
    } finally {
        showLoading(false);
    }
}

// نمایش وضعیت بارگذاری
function showLoading(show) {
    const dashboard = document.getElementById('servicesDashboard');
    if (show) {
        dashboard.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> در حال بارگذاری اطلاعات سرویس‌ها...</div>';
    }
}

// نمایش خطا
function showError(message) {
    const dashboard = document.getElementById('servicesDashboard');
    dashboard.innerHTML = `
        <div class="service-card" style="grid-column: 1/-1; text-align: center; color: var(--danger);">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
            <h3>${message}</h3>
            <p>لطفاً دقایقی دیگر مجدد تلاش کنید</p>
            <button onclick="loadData()" style="background: var(--gold); color: var(--dark); border: none; padding: 10px 20px; border-radius: 5px; margin-top: 20px; cursor: pointer;">
                تلاش مجدد
            </button>
        </div>
    `;
}

// به‌روزرسانی زمان آخرین بروزرسانی
function updateLastUpdate() {
    if (statusData.lastUpdate) {
        const date = new Date(statusData.lastUpdate);
        const persianDate = moment(date).format('jYYYY/jMM/jDD HH:mm');
        document.getElementById('lastUpdate').textContent = persianDate + ' (ایران)';
    }
}

// رندر سرویس‌ها
function renderServices() {
    const dashboard = document.getElementById('servicesDashboard');
    dashboard.innerHTML = '';
    
    CONFIG.services.forEach(service => {
        const serviceStatus = statusData.services?.[service.id] || { status: 'unknown', uptime: 0 };
        const card = createServiceCard(service, serviceStatus);
        dashboard.innerHTML += card;
    });
}

// ایجاد کارت سرویس
function createServiceCard(service, status) {
    const daysLeft = calculateDaysLeft(service.renewalDate);
    const statusConfig = getStatusConfig(status.status);
    const daysClass = getDaysClass(daysLeft);
    const dateClass = getDateClass(daysLeft);
    
    return `
        <div class="service-card">
            <div class="service-header">
                <div class="service-name">
                    <i class="fas fa-server" style="color: ${service.color}; margin-left: 10px;"></i>
                    ${service.name}
                </div>
                <div class="status-badge ${statusConfig.class}">
                    <i class="fas ${statusConfig.icon} status-icon"></i>
                    ${statusConfig.text}
                </div>
            </div>
            
            <div class="service-info">
                <div class="info-row">
                    <span class="info-label">آدرس سرویس:</span>
                    <span class="info-value" style="color: ${service.color};">${service.url}</span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">میزان دسترسی:</span>
                    <span class="info-value">
                        <i class="fas fa-chart-pie" style="color: ${service.color}; margin-left: 5px;"></i>
                        ${status.uptime}%
                    </span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">روزهای باقی‌مانده:</span>
                    <span class="info-value ${daysClass}">
                        <i class="fas fa-calendar ${daysClass === 'days-overdue' ? 'fa-exclamation' : 'fa-clock'}"></i>
                        ${formatDaysLeft(daysLeft)}
                    </span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">تاریخ تمدید:</span>
                    <span class="info-value ${dateClass}">
                        <i class="fas fa-calendar-alt"></i>
                        ${service.renewalDate}
                    </span>
                </div>
            </div>
            
            <div class="message-box">
                <i class="fas ${statusConfig.messageIcon}" style="color: ${statusConfig.color}; margin-left: 10px;"></i>
                ${statusConfig.message}
            </div>
        </div>
    `;
}

// محاسبه روزهای باقی‌مانده
function calculateDaysLeft(renewalDate) {
    if (renewalDate === 'نامحدود') return Infinity;
    
    const now = moment();
    const renewal = moment(renewalDate, 'jYYYY/jMM/jDD');
    
    if (!renewal.isValid()) return null;
    
    return renewal.diff(now, 'days');
}

// فرمت‌بندی روزهای باقی‌مانده
function formatDaysLeft(days) {
    if (days === Infinity) return 'نامحدود';
    if (days === null) return 'نامشخص';
    if (days > 0) return `${days} روز`;
    if (days === 0) return 'امروز';
    return `${Math.abs(days)} روز گذشته`;
}

// کلاس روزهای باقی‌مانده
function getDaysClass(days) {
    if (days === Infinity) return 'days-normal';
    if (days === null) return 'days-normal';
    if (days > 10) return 'days-normal';
    if (days > 0) return 'days-warning';
    return 'days-overdue';
}

// کلاس تاریخ تمدید
function getDateClass(days) {
    if (days === Infinity) return 'date-normal';
    if (days === null) return 'date-normal';
    if (days > 10) return 'date-normal';
    if (days > 0) return 'date-warning';
    return 'date-overdue';
}

// تنظیمات وضعیت‌ها
function getStatusConfig(status) {
    const configs = {
        active: {
            class: 'status-active',
            icon: 'fa-check-circle',
            text: 'فعال',
            color: '#4CAF50',
            message: 'سرویس شما با موفقیت در حال فعالیت است ✅',
            messageIcon: 'fa-smile'
        },
        heavy: {
            class: 'status-heavy',
            icon: 'fa-exclamation-triangle',
            text: 'سنگینی بار',
            color: '#FF9800',
            message: 'سنگینی بار روی سرور - سیستم تا ساعت ۴ بامداد به صورت خودکار بازنشانی می‌شود ⏳',
            messageIcon: 'fa-clock'
        },
        inactive: {
            class: 'status-inactive',
            icon: 'fa-times-circle',
            text: 'غیرفعال',
            color: '#F44336',
            message: 'سرویس غیرفعال - لطفاً به پشتیبانی مراجعه نمایید 🆘',
            messageIcon: 'fa-life-ring'
        },
        unknown: {
            class: 'status-inactive',
            icon: 'fa-question-circle',
            text: 'نامشخص',
            color: '#9E9E9E',
            message: 'وضعیت سرویس نامشخص است - در حال بررسی...',
            messageIcon: 'fa-search'
        }
    };
    
    return configs[status] || configs.unknown;
}

// رندر نمودارها
function renderCharts() {
    renderWeeklyChart();
    renderMonthlyChart();
}

// نمودار هفتگی
function renderWeeklyChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    if (charts.weekly) {
        charts.weekly.destroy();
    }
    
    const datasets = CONFIG.services.map(service => {
        const history = historyData[service.id]?.weekly || [];
        return {
            label: service.name,
            data: history,
            borderColor: service.color,
            backgroundColor: service.color + '20',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: service.color
        };
    });
    
    const labels = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    
    charts.weekly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#E0E0E0',
                        font: {
                            family: 'Vazir',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    rtl: true,
                    bodyFont: {
                        family: 'Vazir'
                    },
                    titleFont: {
                        family: 'Vazir'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#AAA'
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)'
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#AAA',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)'
                    }
                }
            }
        }
    });
}

// نمودار ماهانه
function renderMonthlyChart() {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    
    if (charts.monthly) {
        charts.monthly.destroy();
    }
    
    const datasets = CONFIG.services.map(service => {
        const history = historyData[service.id]?.monthly || [];
        return {
            label: service.name,
            data: history,
            borderColor: service.color,
            backgroundColor: service.color + '20',
            borderWidth: 2,
            fill: true,
            tension: 0.2,
            pointRadius: 2
        };
    });
    
    const labels = Array.from({length: 30}, (_, i) => (i + 1).toString());
    
    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#E0E0E0',
                        font: {
                            family: 'Vazir',
                            size: 12
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#AAA'
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#AAA',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)'
                    }
                }
            }
        }
    });
}

// شروع برنامه
document.addEventListener('DOMContentLoaded', () => {
    // بارگذاری اولیه
    loadData();
    
    // تنظیم بروزرسانی خودکار
    setInterval(loadData, CONFIG.updateInterval);
    
    // نمایش راهنمای اضافه کردن سرویس در کنسول
    console.log('%c📋 راهنمای اضافه کردن سرویس جدید:', 'color: #C7A46C; font-size: 16px; font-weight: bold;');
    console.log('%c1. فایل app.js را باز کنید', 'color: #4CAF50;');
    console.log('%c2. به آرایه services در CONFIG یک آبجکت جدید اضافه کنید:', 'color: #4CAF50;');
    console.log(`%c{
  id: 'new-service',
  name: 'نام سرویس جدید',
  url: 'https://example.com/panel',
  renewalDate: '1404/12/30',
  color: '#2196F3'
}`, 'color: #2196F3; background: #333; padding: 10px; border-radius: 5px;');
    console.log('%c3. فایل monitor.py را نیز به‌روزرسانی کنید', 'color: #4CAF50;');
});

// تابع کمکی برای فارسی‌سازی اعداد
function toPersianNumbers(num) {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/\d/g, x => persianDigits[x]);
}