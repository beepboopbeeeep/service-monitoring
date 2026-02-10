import requests
import json
import os
from datetime import datetime
import jdatetime

CONFIG_FILE = 'servers.json'
DATA_FILE = 'status_data.json'

def check_service(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        content = response.text.lower()
        if "panel" in content or "login" in content or "password" in content:
            return "active", "فعال"
        elif "rate" in content or "1027" in content:
            return "warning", "ترافیک بالا"
        return "inactive", "قطع"
    except:
        return "inactive", "خطای اتصال"

def main():
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        servers = json.load(f)
    
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            old_data = json.load(f)
    else:
        old_data = {"global_history": {}}

    current_time = jdatetime.datetime.now().strftime("%H:%M - %Y/%m/%d")
    today_key = jdatetime.datetime.now().strftime("%Y/%m/%d")
    
    results = {"last_updated": current_time, "servers": []}
    active_count = 0

    for server in servers:
        status_code, status_text = check_service(server['url'])
        if status_code == "active": active_count += 1
        
        # تاریخچه ۲۰ بررسی آخر هر سرور
        history = old_data.get("server_histories", {}).get(str(server['id']), [])
        history.append(status_code)
        history = history[-20:]

        results["servers"].append({
            "id": server['id'],
            "name": server['name'],
            "expiry_date": server['expiry_date'],
            "status_code": status_code,
            "status_text": status_text,
            "history": history
        })

    # محاسبه آپتایم کل امروز (درصد)
    daily_score = (active_count / len(servers)) * 100 if servers else 0
    global_history = old_data.get("global_history", {})
    global_history[today_key] = round(daily_score, 1)
    
    # نگه داشتن ۳۰ روز آخر
    sorted_days = sorted(global_history.keys())[-30:]
    results["global_history"] = {d: global_history[d] for d in sorted_days}
    results["server_histories"] = {str(s["id"]): s["history"] for s in results["servers"]}

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
