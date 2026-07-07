import requests

query = """
[out:json][timeout:60];
(
  way["junction"="roundabout"](14.8,73.6,15.9,74.35);
  node["highway"="traffic_signals"](14.8,73.6,15.9,74.35);
  node["highway"="stop"](14.8,73.6,15.9,74.35);
);
out geom;
"""

url = "https://lz4.overpass-api.de/api/interpreter"
try:
    resp = requests.post(url, data={'data': query}, headers={'User-Agent': 'GripMobapp/1.0'})
    print("Status:", resp.status_code)
    print("Response:", resp.text[:100])
except Exception as e:
    print("Error:", e)
