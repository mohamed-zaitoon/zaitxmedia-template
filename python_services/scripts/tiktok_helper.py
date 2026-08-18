#!/usr/bin/env python3
"""
TikTok Coin Automation Helper
Calculates coin packages using dynamic exchange rates supplied securely from Firestore.
"""
import sys
import json

def calculate_tiktok_coins(coins_count: int, usd_rate: float):
    if usd_rate <= 0:
        raise ValueError("Invalid USD exchange rate provided from database")

    cost_per_coin_usd = 0.0105
    total_cost_usd = coins_count * cost_per_coin_usd
    total_cost_egp = total_cost_usd * usd_rate

    return {
        "status": "success",
        "coins_count": coins_count,
        "total_cost_usd": round(total_cost_usd, 2),
        "total_cost_egp": round(total_cost_egp, 2),
        "usd_rate": usd_rate
    }

if __name__ == "__main__":
    try:
        coins = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
        rate = float(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else 50.0
        result = calculate_tiktok_coins(coins, rate)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)
