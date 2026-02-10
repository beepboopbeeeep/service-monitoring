import requests
import json
import datetime
import os
import pytz

# ==========================================
# تنظیمات سرویس‌ها (اینجا رو ادیت کن)
# تاریخ‌ها باید به صورت میلادی باشند: YYYY-MM-DD
# ==========================================
SERVICES = [
    {
        "name": "سرویس مرکزی",
        "url": "https://tellmeimright.taxyvy.workers.dev/panel",
        "expiry": "2099-12-30",  # تاریخ دور برای نامحدود
        "alias": "central", # یک شناسه انگلیسی کوتاه
        "is_unlimited": True # اگر نامحدود است True بزار
    },
    {
        "name": "سرویس سلطان",
        "url": "https://hitmeintheyes.judiopu.workers.dev/panel",
        "expiry": "2026-03-12", # معادل 21/12/1404
        "alias": "soltan",
        "is_unlimited": False
    }
]

# فایل ذخیره اطلاعات
DATA_FILE = "data.json"
MAX_HISTORY = 672  # نگهداری تاریخچه برای حدود 1 ماه (اگر ساعتی یکبار اجرا شود)

def check_service(url):
    try:
        response = requests.get(url, timeout=15)
        text = response.text.lower()
        
        # لاجیک تشخیص وضعیت
        if "panel" in text:
            return "active", 100 # وضعیت سبز
        elif "rate" in text or "1027" in text:
            return "warning", 50 # وضعیت سنگینی بار
        elif "1101" in text:
            return "error", 0 # وضعیت غیرفعال
        else:
            return "error", 0 # هر چیز دیگر غیرفعال
            
    except Exception as e:
        return "error", 0

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"history": [], "current": []}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def main():
    # تنظیم زمان به وقت ایران
    tehran_tz = pytz.timezone('Asia/Tehran')
    now = datetime.datetime.now(tehran_tz)
    timestamp_str = now.strftime("%Y-%m-%d %H:%M")
    
    data = load_data()
    
    current_status_list = []
    history_point = {"time": timestamp_str, "services": {}}
    
    print(f"--- Check Started: {timestamp_str} ---")
    
    for service in SERVICES:
        status, score = check_service(service["url"])
        print(f"Checking {service['name']}... Status: {status}")
        
        # اطلاعات برای نمایش لحظه‌ای
        service_info = {
            "name": service["name"],
            "status": status,
            "expiry": service["expiry"],
            "is_unlimited": service.get("is_unlimited", False)
        }
        current_status_list.append(service_info)
        
        # اطلاعات برای نمودار
        history_point["services"][service["name"]] = score

    # آپدیت هیستوری
    data["history"].append(history_point)
    
    # محدود کردن حجم هیستوری (حذف قدیمی‌ها)
    if len(data["history"]) > MAX_HISTORY:
        data["history"] = data["history"][-MAX_HISTORY:]
    
    # ذخیره وضعیت فعلی
    data["current"] = current_status_list
    data["last_updated"] = timestamp_str
    
    save_data(data)
    print("--- Check Finished & Saved ---")

if __name__ == "__main__":
    main()
