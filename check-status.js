const fs = require('fs');

// تنظیمات سرویس‌ها (همانند فایل HTML)
const services = [
    { id: 'central', url: 'https://tellmeimright.taxyvy.workers.dev/panel' },
    { id: 'sultan', url: 'https://hitmeintheyes.judiopu.workers.dev/panel' }
];

async function checkService(service) {
    try {
        // استفاده از fetch در Node.js
        const response = await fetch(service.url);
        const text = await response.text();
        
        let status = 'inactive';
        if (text.includes('panel')) {
            status = 'active';
        } else if (text.includes('rate') || text.includes('1027')) {
            status = 'load';
        } else if (text.includes('1101') || true) { // هر چیز دیگر
            status = 'inactive';
        }

        return { id: service.id, status: status };
    } catch (error) {
        console.error(`Error checking ${service.id}:`, error);
        return { id: service.id, status: 'inactive' };
    }
}

async function main() {
    const results = await Promise.all(services.map(checkService));
    
    // ذخیره نتایج در فایل JSON
    fs.writeFileSync('status-data.json', JSON.stringify(results, null, 2));
    console.log('Status data updated:', results);
}

main();
