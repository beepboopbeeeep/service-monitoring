import requests
import json
import os
from datetime import datetime
import jdatetime

# تنظیمات فایل‌ها
CONFIG_FILE = 'servers.json'
DATA_FILE = 'status_data.json'

def check_service(url):
    try:
        response = requests.get(url, timeout=10)
        content = response.text
        
        # منطق تشخیص وضعیت طبق درخواست تو
        if "panel" in content:
            return "active", "فعال"
        elif "rate" in content or "1027" in content:
            return "warning", "سنگینی بار سرور"
        elif "1101" in content:
            return "inactive", "غیرفعال"
        else:
            return "inactive", "غیرفعال (نامشخص)"
    except Exception as e:
        return "inactive", "خطا در اتصال"

def calculate_days_left(expiry_date_str):
    if expiry_date_str == "unlimited":
        return 9999 # کد برای نامحدود
    
    try:
        # تبدیل تاریخ شمسی به میلادی برای محاسبه
        y, m, d = map(int, expiry_date_str.split('/'))
        expiry_gregorian = jdatetime.date(y, m, d).togregorian()
        today = datetime.now().date()
        delta = expiry_gregorian - today
        return delta.days
    except:
        return 0

def load_previous_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def main():
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        servers = json.load(f)
    
    prev_data = load_previous_data()
    current_time = jdatetime.datetime.now().strftime("%H:%M - %Y/%m/%d")
    
    results = {
        "last_updated": current_time,
        "servers": []
    }
    
    for server in servers:
        status_code, status_text = check_service(server['url'])
        days_left = calculate_days_left(server['expiry_date'])
        
        # سیستم تاریخچه (Uptime History)
        # آخرین ۱۰ بررسی رو نگه میداریم برای نمودار کوچک
        history = prev_data.get(str(server['id']), {}).get('history', [])
        history.append(status_code) 
        if len(history) > 20: # فقط ۲۰ تا لاگ آخر رو نگه دار
            history.pop(0)

        server_data = {
            "id": server['id'],
            "name": server['name'],
            "expiry_date": server['expiry_date'],
            "status_code": status_code, # active, warning, inactive
            "status_text": status_text,
            "days_left": days_left,
            "history": history
        }
        results["servers"].append(server_data)
        
        # ذخیره برای دور بعد (History continuity)
        if str(server['id']) not in prev_data:
            prev_data[str(server['id'])] = {}
        prev_data[str(server['id'])]['history'] = history

    # ذخیره فایل نهایی که سایت میخونه
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # ذخیره فایل دیتابیس داخلی (اختیاری اگر بخوایم هیستوری حفظ بشه بین اجراها در اکشن)
    # در گیت‌هاب اکشن باید فایل کامیت بشه تا هیستوری بمونه.

if __name__ == "__main__":
    main()
