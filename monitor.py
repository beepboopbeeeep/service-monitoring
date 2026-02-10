import requests
import json
import os
import jdatetime
import pytz
from datetime import datetime

# تنظیمات
SERVICES_FILE = 'services.json'
DATA_FILE = 'data.json'
HISTORY_LIMIT = 30  # تعداد نقاط داده برای نمودار (مثلاً ۳۰ چک آخر)

def get_status(url):
    try:
        response = requests.get(url, timeout=10)
        content = response.text
        
        # لاجیک تشخیص وضعیت طبق درخواست
        if "panel" in content:
            return "active", 1.0  # 1.0 = 100% health
        elif "rate" in content or "1027" in content:
            return "warning", 0.5 # 0.5 = 50% health
        else:
            return "inactive", 0.0 # 0.0 = 0% health
    except:
        return "inactive", 0.0

def calculate_days_left(expiry_str):
    if expiry_str == "unlimited":
        return 9999
    
    # استفاده از تاریخ امروز ایران
    today = jdatetime.date.today()
    try:
        y, m, d = map(int, expiry_str.split('/'))
        expiry = jdatetime.date(y, m, d)
        delta = expiry - today
        return delta.days
    except:
        return 0

def update_data():
    # بارگذاری سرویس‌ها
    with open(SERVICES_FILE, 'r', encoding='utf-8') as f:
        services = json.load(f)
    
    # بارگذاری دیتای قبلی برای حفظ تاریخچه
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            old_data = json.load(f)
            # نگاشت تاریخچه قبلی سرویس‌ها
            service_history_map = {s['id']: s.get('history', []) for s in old_data.get('services', [])}
            # نگاشت تاریخچه کلی سیستم
            global_history = old_data.get('global_history', [])
    else:
        service_history_map = {}
        global_history = []

    # زمان فعلی به شمسی
    ir_tz = pytz.timezone('Asia/Tehran')
    now_ir = datetime.now(ir_tz)
    # فرمت: ۱۴۰۳/۰۸/۱۲ - ۲۲:۳۰
    j_date = jdatetime.datetime.fromgregorian(datetime=now_ir)
    timestamp_str = j_date.strftime("%Y/%m/%d - %H:%M")
    
    processed_services = []
    total_health_score = 0
    
    for service in services:
        status, health_score = get_status(service['url'])
        days_left = calculate_days_left(service['expiry'])
        total_health_score += health_score
        
        # مدیریت تاریخچه اختصاصی هر سرویس (برای نمودار کوچک داخل کارت)
        s_history = service_history_map.get(service['id'], [])
        s_history.append(health_score)
        if len(s_history) > 20: # فقط ۲۰ نقطه آخر برای کارت‌های کوچک کافیه
            s_history.pop(0)

        processed_services.append({
            "id": service['id'],
            "name": service['name'],
            "status": status, 
            "expiry_date": service['expiry'],
            "days_left": days_left,
            "history": s_history
        })

    # محاسبه وضعیت کلی سیستم (میانگین سلامت همه سرویس‌ها)
    if services:
        system_average = round((total_health_score / len(services)) * 100, 1)
    else:
        system_average = 0

    # ذخیره در تاریخچه کلی (برای نمودارهای اصلی بالا)
    global_history.append({
        "time": j_date.strftime("%H:%M"),
        "score": system_average
    })
    
    # محدود کردن تاریخچه کلی به مثلا ۵۰ نقطه آخر که نمودار خیلی فشرده نشه
    if len(global_history) > 50:
        global_history.pop(0)

    final_data = {
        "last_updated": timestamp_str,
        "global_history": global_history,
        "services": processed_services
    }

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_data()
