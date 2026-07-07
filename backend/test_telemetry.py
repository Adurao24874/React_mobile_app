import sys
import json
import os
import pandas as pd
from telemetry import classify_dataframe
import webbrowser

def get_color(label):
    colors = {
        'POTHOLE': '#dc2626',
        'BAD': '#ef4444',
        'OBSTACLE': '#a855f7',
        'HUMP': '#3b82f6',
        'RUMBLE': '#eab308',
        'MINOR': '#f59e0b',
        'GOOD': '#22c55e'
    }
    return colors.get(label, '#22c55e')

def build_html_map(raw_readings, events, output_file="test_map.html"):
    # Filter out missing lat/lng in raw readings for the path
    valid_readings = [r for r in raw_readings if r.get('lat') and r.get('lng')]
    if not valid_readings:
        print("No valid GPS coordinates in readings to plot map.")
        return

    center_lat = valid_readings[0]['lat']
    center_lng = valid_readings[0]['lng']

    # Build JS array for the route polyline
    route_coords = [[r['lat'], r['lng']] for r in valid_readings]

    # Build JS array for the markers
    markers_js = ""
    for ev in events:
        lat = ev['latitude']
        lng = ev['longitude']
        label = ev['label']
        color = get_color(label)
        popup = f"<b>{label}</b><br>Lat: {lat:.5f}<br>Lng: {lng:.5f}<br>Samples: {ev['samples']}<br>RMS: {ev['vibration_intensity']:.2f}"
        
        markers_js += f"""
        L.circleMarker([{lat}, {lng}], {{
            radius: 6,
            fillColor: "{color}",
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }}).bindPopup("{popup}").addTo(map);
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>GRIP Telemetry Test Map</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
            #map {{ width: 100%; height: 100vh; margin: 0; padding: 0; }}
            body {{ margin: 0; }}
            .legend {{
                background: white; padding: 10px; border-radius: 5px;
                box-shadow: 0 0 15px rgba(0,0,0,0.2);
                position: absolute; bottom: 30px; left: 30px; z-index: 1000;
                font-family: sans-serif;
            }}
            .legend div {{ margin-bottom: 5px; }}
            .legend span {{ display: inline-block; width: 15px; height: 15px; margin-right: 5px; border: 1px solid #000; border-radius: 50%; }}
        </style>
    </head>
    <body>
        <div id="map"></div>
        <div class="legend">
            <h4>Telemetry Events</h4>
            <div><span style="background: #dc2626;"></span> POTHOLE</div>
            <div><span style="background: #ef4444;"></span> BAD</div>
            <div><span style="background: #a855f7;"></span> OBSTACLE</div>
            <div><span style="background: #3b82f6;"></span> HUMP</div>
            <div><span style="background: #eab308;"></span> RUMBLE</div>
            <div><span style="background: #f59e0b;"></span> MINOR</div>
            <div><span style="background: #22c55e;"></span> GOOD</div>
        </div>
        <script>
            var map = L.map('map').setView([{center_lat}, {center_lng}], 16);
            
            L.tileLayer('https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png', {{
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap &copy; CARTO'
            }}).addTo(map);

            var route = {route_coords};
            L.polyline(route, {{color: 'blue', weight: 3, opacity: 0.5}}).addTo(map);

            {markers_js}
        </script>
    </body>
    </html>
    """

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"✅ Generated map at {output_file}")
    
    # Auto-open in browser
    webbrowser.open('file://' + os.path.realpath(output_file))


def process_test_file(file_path):
    print(f"📖 Reading local file: {file_path}")
    with open(file_path, 'r') as f:
        payload = json.load(f)
    
    readings = payload.get('readings', [])
    if not readings:
        print("No readings found in file.")
        return

    print(f"📊 Loaded {len(readings)} sensor samples into RAM")
    print("🧠 Processing telemetry (High-Pass + Complementary Math)...")
    
    df = pd.DataFrame(readings)
    if df.empty:
        print("⚠️ Telemetry skipped: batch has 0 readings.")
        return

    # Normalize columns as in worker.py
    df = df.rename(columns={
        'accelX': 'accel_x', 'accelY': 'accel_y', 'accelZ': 'accel_z',
        'gyroX': 'gyro_x', 'gyroY': 'gyro_y', 'gyroZ': 'gyro_z',
        'lat': 'latitude', 'lng': 'longitude'
    })

    if 'latitude' in df.columns and 'longitude' in df.columns:
        df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
        df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')

    if 'speed' in df.columns:
        df['speed'] = pd.to_numeric(df['speed'], errors='coerce')
        df = df[df['speed'] >= 2.0]

    events, _ = classify_dataframe(
        df,
        min_samples=50,
        use_gyro=True,
        axis_mode='gyro'
    )

    print(f"🗺️ Extracted {len(events)} physical street map points.")
    
    # Generate HTML Map
    output_html = os.path.splitext(file_path)[0] + "_map.html"
    build_html_map(readings, events, output_html)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test_telemetry.py <path_to_json_file>")
        sys.exit(1)
    
    target_file = sys.argv[1]
    if not os.path.exists(target_file):
        print(f"File not found: {target_file}")
        sys.exit(1)
        
    process_test_file(target_file)
