import urllib.request
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json'
}

all_cards = []
offset = 0
limit = 100

while True:
    url = f'https://api.netdeck.gg/api/cards/cyberpunk?limit={limit}&offset={offset}'
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    items = data.get('items', [])
    if not items:
        break
    all_cards.extend(items)
    offset += len(items)
    total = data.get('total', 0)
    print(f"Fetched {len(all_cards)} / {total} cards...")
    if len(all_cards) >= total:
        break

print(f"Done! Total cards fetched: {len(all_cards)}")
with open('data/weirdco_official_raw.json', 'w', encoding='utf-8') as f:
    json.dump(all_cards, f, indent=2)

print("Saved raw card data to data/weirdco_official_raw.json")
