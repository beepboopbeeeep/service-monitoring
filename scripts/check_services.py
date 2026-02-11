import requests
import json
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo # برای تنظیم منطقه زمانی (از پایتون 3.9 به بالا موجود است)
import jdatetime

# ==========================================
# تنظیمات سرویس‌ها (اینجا را ویرایش کنید)
# ==========================================
services_config = [
    {
        "name": "سرویس مرکزی",
        "url": "https://tellmeimright.taxyvy.workers.dev/panel",
        "renewal_date": "نامحدود", # فرمت: "YYYY/MM/DD" یا "نامحدود"
        "color": "#C7A46C"
    },
    {
        "name": "سرویس سلطان",
        "url": "https://hitmeintheeyes.judiopu.workers.dev/panel",
        "renewal_date": "1404/12/21",
        "color": "#FF5722"
    },
    {
        "name": "سرویس سینا",
        "url": "https://sinafam.halimash.workers.dev/panel",
        "renewal_date": "1404/12/22",
        "color": "#00ffaa"
    },
    {
        "name": "سرویس امید",
        "url": "https://omid.mastmusir.workers.dev/panel",
        "renewal_date": "1404/12/22",
        "color": "#0084ff"
    }
    # برای اضافه کردن سرویس جدید، یک دیکشنری مشابه بالا اضافه کنید
]

# فایل ذخیره داده‌ها
DATA_FILE = "data.json"
HISTORY_LENGTH = 4500 # تعداد رکوردهای تاریخچه نگهداری شده

def get_status(content):
    """بررسی وضعیت سرویس بر اساس محتوای صفحه"""
    if "panel" in content:
        return "active"
    elif "rate" in content or "1027" in content:
        return "high_load"
    else:
        return "inactive"

def get_message(status):
    """تولید پیام مناسب بر اساس وضعیت"""
    if status == "active":
        return "تبریک! سرویس شما با موفقیت در حال فعالیت است."
    elif status == "high_load":
        return "سنگینی بار روی سرور. نگران نباشید، تا ساعت ۳:۳۰ تا ۴ بامداد به وقت ایران منتظر بمانید."
    else:
        return "سرویس غیرفعال است. لطفاً به پشتیبانی مراجعه کنید."

def calculate_days_remaining(renewal_date_str):
    """محاسبه روزهای باقی‌مانده تا تمدید"""
    if renewal_date_str.lower() == "نامحدود":
        return None
    
    try:
        # فرض بر تاریخ شمسی
        r_year, r_month, r_day = map(int, renewal_date_str.split('/'))
        renewal_date = jdatetime.date(r_year, r_month, r_day)
        today = jdatetime.date.today()
        
        delta = renewal_date - today
        return delta.days
    except Exception as e:
        print(f"Error parsing date {renewal_date_str}: {e}")
        return None

def main():
    services_data = []
    history_entry = []
    
    # دریافت زمان فعلی به صورت UTC
    utc_now = datetime.now(timezone.utc)
    # تبدیل زمان به منطقه زمانی تهران
    tehran_now = utc_now.astimezone(ZoneInfo("Asia/Tehran"))
    
    # تبدیل به تاریخ شمسی برای نمایش
    jalali_now = jdatetime.datetime.fromgregorian(datetime=tehran_now)
    last_update_str = jalali_now.strftime("%Y/%m/%d %H:%M")

    for config in services_config:
        try:
            response = requests.get(config["url"], timeout=10)
            content = response.text
            status = get_status(content)
        except Exception as e:
            print(f"Error fetching {config['name']}: {e}")
            status = "inactive" # در صورت خطای شبکه، غیرفعال در نظر گرفته می‌شود

        message = get_message(status)
        days_remaining = calculate_days_remaining(config["renewal_date"])
        
        service_info = {
            "name": config["name"],
            "status": status,
            "renewal_date": config["renewal_date"],
            "days_remaining": days_remaining,
            "message": message,
            "url": config["url"] # اختیاری: برای دیباگ
        }
        services_data.append(service_info)

        # افزودن به تاریخچه نمودار
        # فرمت time_label برای نمایش در محور X نمودار
        time_label = jalali_now.strftime("%H:%M")
        history_entry.append({
            "timestamp": tehran_now.isoformat(),
            "time_label": time_label,
            "service_name": config["name"],
            "status": status
        })

    # خواندن تاریخچه قبلی
    existing_history = []
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
                existing_history = old_data.get("history", [])
        except:
            pass

    # ادغام تاریخچه جدید با قدیمی و محدود کردن تعداد
    new_history = existing_history + history_entry
    if len(new_history) > HISTORY_LENGTH:
        new_history = new_history[-HISTORY_LENGTH:]

    # ساخت داده نهایی
    final_data = {
        "last_update": last_update_str,
        "services": services_data,
        "history": new_history
    }

    # ذخیره فایل
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

    print("Data updated successfully.")

if __name__ == "__main__":
    main()
