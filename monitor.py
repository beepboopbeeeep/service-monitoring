import requests
import json
import os
from datetime import datetime
import jdatetime

# تنظیمات
CONFIG_FILE = 'servers.json'
DATA_FILE = 'status_data.json'

def check_service(url):
    # هدرهای کامل‌تر برای شبیه‌سازی دقیق مرورگر کروم
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
    
    try:
        print(f"\n--- Checking: {url} ---") # شروع لاگ
        response = requests.get(url, headers=headers, timeout=20, allow_redirects=True)
        content = response.text.lower()
        
        # چاپ وضعیت کد HTTP
        print(f"HTTP Status: {response.status_code}")
        
        # شرط‌ها
        if "panel" in content:
            print("Found 'panel' -> ACTIVE")
            return "active", "فعال"
        
        elif "rate" in content or "1027" in content:
            print("Found 'rate/1027' -> WARNING")
            return "warning", "سنگینی بار سرور"
            
        elif "1101" in content:
            print("Found '1101' -> INACTIVE")
            return "inactive", "غیرفعال"
            
        else:
            # اینجا جاییه که مشکل داری. بیایم ببینیم چی دیده که ما ندیدیم
            print("!!! KEYWORD NOT FOUND !!!")
            print("Here is what python saw (First 500 chars):")
            print(content[:500]) # چاپ ۵۰۰ کاراکتر اول برای دیباگ
            print("------------------------------------------")
            
            # یک شانس دوم: اگر استاتوس 200 بود ولی کلمه پنل نبود
            # ممکنه صفحه لاگین باشه که توش کلمه password یا login هست
            if response.status_code == 200:
                if "login" in content or "username" in content or "password" in content or "sign in" in content:
                     return "active", "فعال"

            return "inactive", "غیرفعال (نامشخص)"

    except Exception as e:
        print(f"Error: {str(e)}")
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
            try: return json.load(f)
            except: return {}
    return {}

def main():
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        servers = json.load(f)
    
    prev_data = load_previous_data()
    current_time = jdatetime.datetime.now().strftime("%H:%M - %Y/%m/%d")
    
    results = {"last_updated": current_time, "servers": []}
    
    for server in servers:
        status_code, status_text = check_service(server['url'])
        days_left = calculate_days_left(server['expiry_date'])
        
        history = prev_data.get(str(server['id']), {}).get('history', [])
        history.append(status_code) 
        if len(history) > 20: history.pop(0)

        server_data = {
            "id": server['id'], "name": server['name'], "expiry_date": server['expiry_date'],
            "status_code": status_code, "status_text": status_text, "days_left": days_left, "history": history
        }
        results["servers"].append(server_data)
        
        if str(server['id']) not in prev_data: prev_data[str(server['id'])] = {}
        prev_data[str(server['id'])]['history'] = history

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
