#!/usr/bin/env python3
"""
اسکریپت مانیتورینگ سرویس‌ها
این اسکریپت هر 10 دقیقه توسط GitHub Actions اجرا می‌شود
"""

import requests
import json
import time
import datetime
import sys
import os
from pathlib import Path

# اضافه کردن پوشه فعلی به مسیر
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# تنظیمات سرویس‌ها - برای اضافه کردن سرویس جدید اینجا ویرایش کنید
SERVICES = [
    {
        "id": "central",
        "name": "سرویس مرکزی",
        "url": "https://tellmeimright.taxyvy.workers.dev/login",
        "renewal_date": "نامحدود",
        "color": "#C7A46C"
    },
    {
        "id": "sultan",
        "name": "سرویس سلطان", 
        "url": "https://hitmeintheyes.judiopu.workers.dev/login",
        "renewal_date": "1404/12/21",
        "color": "#4CAF50"
    }
    # برای اضافه کردن سرویس جدید خط زیر را کپی و ویرایش کنید:
    # {
    #     "id": "new-service",
    #     "name": "نام سرویس جدید",
    #     "url": "https://example.com/panel",
    #     "renewal_date": "1404/12/30",
    #     "color": "#2196F3"
    # }
]

# مسیر فایل‌ها
BASE_DIR = Path(__file__).parent
STATUS_FILE = BASE_DIR / "status.json"
HISTORY_FILE = BASE_DIR / "history.json"

def check_service(url):
    """
    بررسی وضعیت سرویس
    
    حالت‌های بازگشتی:
    - 'active': اگر در صفحه عبارت 'panel' وجود داشته باشد
    - 'heavy': اگر 'rate' یا '1027' وجود داشته باشد
    - 'inactive': سایر موارد
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Monitoring Bot)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        content = response.text.lower()
        
        if 'panel' in content:
            return 'active'
        elif 'rate' in content or '1027' in content:
            return 'heavy'
        else:
            return 'inactive'
            
    except requests.exceptions.RequestException as e:
        print(f"خطا در بررسی {url}: {e}")
        return 'inactive'
    except Exception as e:
        print(f"خطای غیرمنتظره برای {url}: {e}")
        return 'inactive'

def load_json_file(file_path):
    """بارگذاری فایل JSON"""
    try:
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"خطا در خواندن فایل {file_path}: {e}")
    return {}

def save_json_file(file_path, data):
    """ذخیره فایل JSON"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ فایل {file_path.name} ذخیره شد")
        return True
    except Exception as e:
        print(f"❌ خطا در ذخیره {file_path.name}: {e}")
        return False

def calculate_uptime(service_id, status, history_data):
    """محاسبه میزان دسترسی (Uptime)"""
    if service_id not in history_data:
        history_data[service_id] = {"daily": [], "weekly": [], "monthly": []}
    
    daily_history = history_data[service_id].get("daily", [])
    
    # اضافه کردن وضعیت فعلی به تاریخچه روزانه
    value = 100 if status == 'active' else 50 if status == 'heavy' else 0
    daily_history.append(value)
    
    # نگه داشتن فقط 30 روز اخیر
    if len(daily_history) > 30:
        daily_history = daily_history[-30:]
    
    history_data[service_id]["daily"] = daily_history
    
    # محاسبه میانگین هفتگی (7 روز اخیر)
    weekly_avg = sum(daily_history[-7:]) / min(7, len(daily_history[-7:])) if daily_history[-7:] else 0
    
    # محاسبه میانگین ماهانه (30 روز اخیر)
    monthly_avg = sum(daily_history[-30:]) / min(30, len(daily_history[-30:])) if daily_history[-30:] else 0
    
    # به‌روزرسانی تاریخچه هفتگی و ماهانه
    weekly_history = history_data[service_id].get("weekly", [])
    monthly_history = history_data[service_id].get("monthly", [])
    
    weekly_history.append(round(weekly_avg, 2))
    monthly_history.append(round(monthly_avg, 2))
    
    # نگه داشتن 52 هفته و 12 ماه اخیر
    if len(weekly_history) > 52:
        weekly_history = weekly_history[-52:]
    if len(monthly_history) > 12:
        monthly_history = monthly_history[-12:]
    
    history_data[service_id]["weekly"] = weekly_history
    history_data[service_id]["monthly"] = monthly_history
    
    return round(sum(daily_history) / len(daily_history), 2) if daily_history else 0

def main():
    """تابع اصلی"""
    print("🚀 شروع مانیتورینگ سرویس‌ها...")
    print(f"📅 تاریخ و زمان: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # بارگذاری داده‌های قبلی
    status_data = load_json_file(STATUS_FILE)
    history_data = load_json_file(HISTORY_FILE)
    
    # مقداردهی اولیه
    if "services" not in status_data:
        status_data["services"] = {}
    
    # بررسی هر سرویس
    results = {}
    for service in SERVICES:
        print(f"\n🔍 در حال بررسی {service['name']} ({service['url']})...")
        
        # بررسی وضعیت
        status = check_service(service['url'])
        
        # محاسبه uptime
        uptime = calculate_uptime(service["id"], status, history_data)
        
        # ذخیره نتیجه
        results[service["id"]] = {
            "name": service["name"],
            "url": service["url"],
            "status": status,
            "uptime": uptime,
            "renewal_date": service["renewal_date"],
            "color": service["color"],
            "last_checked": datetime.datetime.now().isoformat()
        }
        
        status_text = {
            "active": "✅ فعال",
            "heavy": "⚠️ سنگینی بار",
            "inactive": "❌ غیرفعال"
        }.get(status, "❓ نامشخص")
        
        print(f"   وضعیت: {status_text}")
        print(f"   میزان دسترسی: {uptime}%")
    
    # به‌روزرسانی داده‌های وضعیت
    status_data["services"] = results
    status_data["lastUpdate"] = datetime.datetime.now().isoformat()
    status_data["totalServices"] = len(SERVICES)
    
    # ذخیره فایل‌ها
    save_json_file(STATUS_FILE, status_data)
    save_json_file(HISTORY_FILE, history_data)
    
    # تولید گزارش
    print("\n📊 گزارش نهایی:")
    active_count = sum(1 for s in results.values() if s["status"] == "active")
    heavy_count = sum(1 for s in results.values() if s["status"] == "heavy")
    inactive_count = sum(1 for s in results.values() if s["status"] == "inactive")
    
    print(f"✅ سرویس‌های فعال: {active_count}")
    print(f"⚠️ سرویس‌های با سنگینی بار: {heavy_count}")
    print(f"❌ سرویس‌های غیرفعال: {inactive_count}")
    
    # ایجاد فایل README با آمار
    generate_readme(status_data, history_data)
    
    print("\n🎉 مانیتورینگ با موفقیت به پایان رسید!")

def generate_readme(status_data, history_data):
    """تولید فایل README با آمار"""
    readme_content = f"""# 📊 پنل مانیتورینگ سرویس‌ها

آخرین بروزرسانی: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 📈 آمار کلی

| شاخص | مقدار |
|------|-------|
| تعداد سرویس‌ها | {len(status_data.get('services', {}))} |
| میانگین Uptime | {calculate_overall_uptime(status_data):.2f}% |
| آخرین بروزرسانی | {status_data.get('lastUpdate', 'نامشخص')} |

## 🚀 راهنمای اضافه کردن سرویس جدید

### 1. ویرایش فایل `monitor.py`
سرویس جدید را به آرایه `SERVICES` اضافه کنید:

```python
{{
    "id": "new-service",
    "name": "نام سرویس جدید",
    "url": "https://example.com/panel",
    "renewal_date": "1404/12/30",
    "color": "#2196F3"
}}
```

### 2. ویرایش فایل `app.js`
همان سرویس را به `CONFIG.services` اضافه کنید.

### 3. تاریخ تمدید
- برای سرویس‌های نامحدود: `"نامحدود"`
- برای سرویس‌های با تاریخ مشخص: `"1404/12/21"` (به صورت شمسی)

## 📊 نمودارها

نمودارهای زیر به صورت خودکار هر 10 دقیقه به‌روز می‌شوند:

1. **نمودار هفتگی**: وضعیت 7 روز اخیر
2. **نمودار ماهانه**: وضعیت 30 روز اخیر

## ⚙️ تنظیمات

- بروزرسانی خودکار: هر 10 دقیقه
- زمان بازنشانی: 3:30 تا 4 بامداد به وقت ایران
- رنگ‌بندی: بر اساس وضعیت سرویس

## 🛠️ توسعه

برای توسعه یا گزارش مشکل، لطفاً Issues گیتهاب را بررسی کنید.

---

*ساخته شده با ❤️ برای GitHub Pages*
"""
    
    with open(BASE_DIR / "README.md", "w", encoding="utf-8") as f:
        f.write(readme_content)
    
    print("📖 فایل README تولید شد")

def calculate_overall_uptime(status_data):
    """محاسبه میانگین کلی uptime"""
    services = status_data.get("services", {}).values()
    if not services:
        return 0
    
    total_uptime = sum(s.get("uptime", 0) for s in services)
    return total_uptime / len(services)

if __name__ == "__main__":
    main()
