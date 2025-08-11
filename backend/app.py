from flask import Flask, request, jsonify
import requests
from datetime import datetime, timedelta
from flask_cors import CORS
from functools import lru_cache
import time

app = Flask(__name__)
CORS(app)

API_URL = "https://uzshopping.retailcrm.ru/api/v5/orders"
API_KEY = "f6pp7FGF3FMS3ufIPEvhvThsgqmWL9XX"

VALID_LOGIN = "admin"
VALID_PASSWORD = "12345"
AUTH_TOKEN = "mysecrettoken123"

@lru_cache(maxsize=1)
def get_cached_orders():
    all_orders = []
    page = 1

    while True:
        params = {'apiKey': API_KEY, 'limit': 100, 'page': page}
        try:
            start_time = time.time()
            resp = requests.get(API_URL, params=params, timeout=10)

            if resp.status_code != 200:
                break

            data = resp.json()
            orders_batch = data.get('orders', [])

            if not orders_batch:
                break

            print(f"Loaded page {page} with {len(orders_batch)} orders in {time.time() - start_time:.2f}s")
            all_orders.extend(orders_batch)
            page += 1

            if len(orders_batch) < 100:
                break

        except Exception as e:
            print(f"Error fetching orders: {str(e)}")
            break

    return all_orders

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    if data.get('login') == VALID_LOGIN and data.get('password') == VALID_PASSWORD:
        return jsonify({"success": True, "token": AUTH_TOKEN})
    return jsonify({"success": False}), 401

@app.route('/orders', methods=['GET'])
def orders():
    auth_header = request.headers.get('Authorization')
    if auth_header != f"Bearer {AUTH_TOKEN}":
        return jsonify({"error": "Unauthorized"}), 401

    start_time = time.time()
    all_orders = get_cached_orders()

    STATUS_GROUPS = {
        'approved': ['payoff', 'complectation', 'delivery', 'completed', 'return'],
        'delivered': ['completed', 'return']
    }

    processed_orders = []
    counters = {
        'total': 0,
        'approved': 0,
        'delivered': 0
    }

    for order in all_orders:
        status = order.get('status')
        items = order.get('items', [])

        qty_total = sum(item.get('quantity', 0) for item in items)
        qty_no_delivery = sum(
            item.get('quantity', 0)
            for item in items
            if 'доставка' not in item.get('offer', {}).get('displayName', '').lower()
        )

        processed_orders.append({
            "number": order.get('number'),
            "status": status,
            "qty_without_delivery": qty_no_delivery,
            "total_qty": qty_total
        })

        counters['total'] += 1
        if status in STATUS_GROUPS['approved']:
            counters['approved'] += 1
        if status in STATUS_GROUPS['delivered']:
            counters['delivered'] += 1

    analytics = {
        "total_orders": int(counters['total']),
        "approved_orders": int(counters['approved']),
        "delivered_orders": int(counters['delivered']),
        "percent_approved": round(counters['approved'] / counters['total'] * 100, 2) if counters['total'] else 0,
        "percent_delivered": round(counters['delivered'] / counters['approved'] * 100, 2) if counters['approved'] else 0
    }

    print(f"Processed {len(all_orders)} orders in {time.time() - start_time:.2f} seconds")

    return jsonify({
        "orders": processed_orders,
        "analytics": analytics,
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)