import requests
import json
import os
from datetime import datetime
import jdatetime
import pytz

# تنظیمات
SERVICES_FILE = 'services.json'
DATA_FILE = 'data.json'
HISTORY_LIMIT = 60  # ذخیره 60 تا چک اخیر برای نمودارها

def get_status(url):
    try:
        response = requests.get(url, timeout=10)
        content = response.text
        
        if "panel" in content:
            return "active", 200
        elif "rate" in content or "1027" in content:
            return "warning", 429
        else:
            return "inactive", 500
    except:
        return "inactive", 0

def calculate_days_left(expiry_str):
    if expiry_str == "unlimited":
        return 9999
    
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
    
    # بارگذاری دیتای قبلی (برای حفظ تاریخچه نمودار)
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            old_data = json.load(f)
            history_map = {s['id']: s.get('history', []) for s in old_data['services']}
    else:
        history_map = {}

    timestamp = datetime.now(pytz.timezone('Asia/Tehran')).strftime("%H:%M - %Y/%m/%d")
    
    processed_services = []
    
    for service in services:
        status, code = get_status(service['url'])
        days_left = calculate_days_left(service['expiry'])
        
        # مدیریت تاریخچه برای نمودار (1: فعال، 0.5: وارنینگ، 0: غیرفعال)
        history = history_map.get(service['id'], [])
        chart_val = 1 if status == "active" else (0.5 if status == "warning" else 0)
        history.append(chart_val)
        if len(history) > HISTORY_LIMIT:
            history.pop(0)

        processed_services.append({
            "id": service['id'],
            "name": service['name'],
            "status": status, # active, warning, inactive
            "expiry_date": service['expiry'],
            "days_left": days_left,
            "history": history
        })

    final_data = {
        "last_updated": timestamp,
        "services": processed_services
    }

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_data()
