import requests
import json
import os
from datetime import datetime
import jdatetime

# تنظیمات فایل‌ها
CONFIG_FILE = 'servers.json'
DATA_FILE = 'status_data.json'

def check_service(url):
    # این هدر باعث میشه سرور فکر کنه ما یک مرورگر واقعی هستیم و مسدودمون نکنه
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # تایم‌اوت رو کمی بیشتر کردیم (۱۵ ثانیه)
        response = requests.get(url, headers=headers, timeout=15)
        # تبدیل کل محتوا به حروف کوچک برای جستجو دقیق‌تر
        content = response.text.lower()
        
        # دیباگ: اگر خواستی توی لاگ‌های گیت‌هاب ببینی چی برگشته (اختیاری)
        # print(f"Checking {url} - Status: {response.status_code}")

        if "panel" in content:
            return "active", "فعال"
        elif "rate" in content or "1027" in content:
            return "warning", "سنگینی بار سرور"
        elif "1101" in content:
            return "inactive", "غیرفعال"
        else:
            # اگر هیچکدوم نبود، یعنی محتوا دانلود شده ولی کلمات کلیدی توش نیست
            # ممکنه صفحه لاگین باشه یا ارور دیگه
            return "inactive", "غیرفعال (نامشخص)"
            
    except requests.exceptions.Timeout:
        return "inactive", "خطا: کندی شبکه"
    except Exception as e:
        return "inactive", "خطا در اتصال"

def calculate_days_left(expiry_date_str):
    if expiry_date_str == "unlimited":
        return 9999
    
    try:
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
            try:
                return json.load(f)
            except:
                return {}
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
        print(f"Checking server: {server['name']}...") # نمایش در لاگ
        status_code, status_text = check_service(server['url'])
        days_left = calculate_days_left(server['expiry_date'])
        
        history = prev_data.get(str(server['id']), {}).get('history', [])
        history.append(status_code) 
        if len(history) > 20:
            history.pop(0)

        server_data = {
            "id": server['id'],
            "name": server['name'],
            "expiry_date": server['expiry_date'],
            "status_code": status_code,
            "status_text": status_text,
            "days_left": days_left,
            "history": history
        }
        results["servers"].append(server_data)
        
        if str(server['id']) not in prev_data:
            prev_data[str(server['id'])] = {}
        prev_data[str(server['id'])]['history'] = history

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
