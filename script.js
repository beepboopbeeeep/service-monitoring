// تابع تبدیل اعداد انگلیسی به فارسی
function toPersianNum(num) {
    if (num === null || num === undefined) return '';
    const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/[0-9]/g, function (w) {
        return id[+w]
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            document.getElementById('last-update').textContent = toPersianNum(data.last_updated);
            renderServices(data.services);
            renderGlobalCharts(data.services);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            document.getElementById('services-container').innerHTML = '<p class="text-red-500 text-center col-span-full">خطا در بارگذاری اطلاعات</p>';
        });
});

function renderServices(services) {
    const container = document.getElementById('services-container');
    container.innerHTML = '';

    services.forEach(service => {
        let statusHtml = '';
        let statusMessage = '';
        
        // منطق وضعیت سرور
        if (service.status === 'active') {
            statusHtml = `<span class="px-3 py-1 rounded-full text-xs font-bold status-badge-active flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> فعال</span>`;
            statusMessage = `<p class="text-xs text-green-400 mt-2">تبریک! سرویس شما با موفقیت فعال است.</p>`;
        } else if (service.status === 'warning') {
            statusHtml = `<span class="px-3 py-1 rounded-full text-xs font-bold status-badge-warning flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-yellow-500 animate-ping"></span> سنگینی بار</span>`;
            statusMessage = `<p class="text-xs text-yellow-400 mt-2">محدودیت ترافیک. تا ۳:۳۰ بامداد صبر کنید.</p>`;
        } else {
            statusHtml = `<span class="px-3 py-1 rounded-full text-xs font-bold status-badge-inactive flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span> غیرفعال</span>`;
            statusMessage = `<p class="text-xs text-red-400 mt-2">لطفا با پشتیبانی تماس بگیرید.</p>`;
        }

        // منطق تاریخ تمدید
        let expiryHtml = '';
        if (service.days_left === 9999) {
            expiryHtml = `<div class="text-[#C7A46C] font-bold">تمدید: نامحدود</div>`;
        } else {
            let daysColor = 'text-gray-300';
            let daysText = `${toPersianNum(service.days_left)} روز مانده`;
            
            if (service.days_left < 0) {
                daysColor = 'text-red-500 font-bold';
                daysText = `${toPersianNum(Math.abs(service.days_left))} روز گذشته (غیرفعال)`;
            } else if (service.days_left === 0) {
                daysColor = 'text-orange-500 font-bold';
                daysText = `امروز روز تمدید است`;
            } else if (service.days_left <= 10) {
                daysColor = 'text-yellow-400 font-bold';
            }

            expiryHtml = `
                <div class="flex justify-between items-center text-sm mb-1">
                    <span class="text-gray-400">تاریخ تمدید:</span>
                    <span class="font-mono text-gray-200">${toPersianNum(service.expiry_date)}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-400">وضعیت اعتبار:</span>
                    <span class="${daysColor}">${daysText}</span>
                </div>
            `;
        }

        // ساخت کارت
        const card = document.createElement('div');
        card.className = 'bg-[#252525] rounded-xl p-6 service-card shadow-lg relative overflow-hidden';
        card.innerHTML = `
            <div class="absolute top-0 right-0 w-20 h-20 bg-[#C7A46C] opacity-5 rounded-bl-full -mr-10 -mt-10"></div>
            
            <div class="flex justify-between items-start mb-4 relative z-10">
                <h2 class="text-xl font-bold text-white">${service.name}</h2>
                ${statusHtml}
            </div>
            
            <div class="mb-4 relative z-10">
                ${statusMessage}
            </div>
            
            <div class="bg-[#1E1E1E] rounded-lg p-3 border border-gray-700 relative z-10">
                ${expiryHtml}
            </div>

            <div class="mt-4 h-16 w-full">
                <canvas id="chart-service-${service.id}"></canvas>
            </div>
        `;
        
        container.appendChild(card);
        
        // رسم نمودار کوچک برای هر سرویس
        renderMiniChart(service.id, service.history);
    });
}

function renderMiniChart(id, history) {
    const ctx = document.getElementById(`chart-service-${id}`).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(() => ''), // لیبل خالی برای زیبایی
            datasets: [{
                data: history,
                borderColor: '#C7A46C',
                borderWidth: 1.5,
                tension: 0.4,
                pointRadius: 0,
                fill: true,
                backgroundColor: 'rgba(199, 164, 108, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false, min: 0, max: 1.2 } }
        }
    });
}

function renderGlobalCharts(services) {
    // داده‌های ساختگی برای نمودار کلی (در واقعیت باید از هیستوری محاسبه شود)
    // اینجا میانگین وضعیت همه سرویس‌ها را نشان می‌دهیم
    
    const chartConfig = (ctx, label) => ({
        type: 'bar',
        data: {
            labels: services.map(s => s.name),
            datasets: [{
                label: label,
                data: services.map(s => {
                    // محاسبه درصد موفقیت از روی هیستوری
                    const activeCount = s.history.filter(h => h === 1).length;
                    return (activeCount / s.history.length) * 100;
                }),
                backgroundColor: '#C7A46C',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: '#333' } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    new Chart(document.getElementById('weeklyChart'), chartConfig(null, 'پایداری ۷ روز گذشته'));
    new Chart(document.getElementById('monthlyChart'), chartConfig(null, 'پایداری ۳۰ روز گذشته'));
}
