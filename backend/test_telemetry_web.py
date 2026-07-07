import os
import json
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import HTMLResponse
import uvicorn
import webbrowser
from telemetry import classify_dataframe
from ml_telemetry import classify_dataframe_ml
from threading import Timer

app = FastAPI(title="GRIP Telemetry Tester Web UI")

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

def build_html_map(raw_readings, events_heuristic, events_ml, df_h):
    valid_readings = [r for r in raw_readings if r.get('lat') and r.get('lng')]
    if not valid_readings:
        return "<h3>Error: No valid GPS coordinates in readings to plot map.</h3>"

    center_lat = valid_readings[0]['lat']
    center_lng = valid_readings[0]['lng']
    route_coords = [[r['lat'], r['lng']] for r in valid_readings]

    def make_markers_js(events, map_name):
        js = ""
        for ev in events:
            lat = ev['latitude']
            lng = ev['longitude']
            label = ev['label']
            color = get_color(label)
            popup = f"<b>{label}</b><br>Lat: {lat:.5f}<br>Lng: {lng:.5f}<br>Samples: {ev['samples']}"
            if 'vibration_intensity' in ev:
                popup += f"<br>RMS: {ev['vibration_intensity']:.2f}"
            js += f"""
            if (!layerGroups_{map_name}["{label}"]) {{
                layerGroups_{map_name}["{label}"] = L.layerGroup().addTo({map_name});
            }}
            L.circleMarker([{lat}, {lng}], {{
                radius: 6,
                fillColor: "{color}",
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }}).bindPopup("{popup}").addTo(layerGroups_{map_name}["{label}"]);
            """
        return js

    markers_h = make_markers_js(events_heuristic, 'mapH')
    markers_m = make_markers_js(events_ml, 'mapM')
    
    from collections import Counter
    counts_h = Counter([e['label'] for e in events_heuristic])
    counts_m = Counter([e['label'] for e in events_ml])
    
    def dict_to_html(c):
        return "".join([f"<span style='margin-left: 10px; font-weight: normal; font-size: 13px; color: #475569;'>{k}: {v}</span>" for k, v in c.items()])
        
    counts_html_h = dict_to_html(counts_h)
    counts_html_m = dict_to_html(counts_m)
    
    import json
    import numpy as np
    
    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.floating):
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            if pd.isna(obj):
                return None
            return super(NumpyEncoder, self).default(obj)
            
    events_json_h = json.dumps(events_heuristic, cls=NumpyEncoder)
    events_json_m = json.dumps(events_ml, cls=NumpyEncoder)
    
    # Filter df_h to only keep relevant columns for the CSV
    csv_cols = ['timestamp', 'win_idx', 'accel_x', 'accel_y', 'accel_z', 'gyro_x', 'gyro_y', 'gyro_z', 'latitude', 'longitude']
    csv_cols = [c for c in csv_cols if c in df_h.columns]
    raw_json = json.dumps(df_h[csv_cols].to_dict(orient='records'), cls=NumpyEncoder)

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>GRIP Telemetry ML vs Heuristic</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://rawcdn.githack.com/jieter/Leaflet.Sync/master/L.Map.Sync.js"></script>
        <style>
            .map-container {{ display: flex; height: calc(100vh - 60px); width: 100%; }}
            .map-box {{ flex: 1; border: 1px solid #ccc; position: relative; }}
            .map-title {{ position: absolute; top: 10px; right: 10px; z-index: 1000; background: white; padding: 5px 10px; font-weight: bold; border-radius: 4px; box-shadow: 0 0 5px rgba(0,0,0,0.3); }}
            body {{ margin: 0; font-family: sans-serif; background: #f8fafc; }}
            .header {{ padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; background: white; }}
            .legend {{
                background: white; padding: 10px; border-radius: 5px;
                box-shadow: 0 0 15px rgba(0,0,0,0.2);
                position: absolute; bottom: 30px; left: 30px; z-index: 1000;
            }}
            .legend div {{ margin-bottom: 5px; font-size: 14px; font-weight: bold; }}
            .legend span {{ display: inline-block; width: 15px; height: 15px; margin-right: 5px; border: 1px solid #000; border-radius: 50%; }}
            .btn {{ padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; font-weight: bold; }}
            .btn:hover {{ background: #2563eb; }}
            .map-canvas {{ height: 100%; width: 100%; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h2 style="margin: 0; color: #0f172a;">🗺️ GRIP ML vs Heuristic Comparison</h2>
            <a href="/" class="btn">Upload Another File</a>
        </div>
        <div class="map-container">
            <div class="map-box">
                <div class="map-title">
                    🤖 Random Forest ML <br>{counts_html_m}
                    <div style="margin-top: 5px;">
                        <select id="csv-class-ml" style="padding: 2px;">
                            <option value="ALL">ALL</option>
                            <option value="POTHOLE">POTHOLE</option>
                            <option value="BAD">BAD</option>
                            <option value="OBSTACLE">OBSTACLE</option>
                            <option value="HUMP">HUMP</option>
                            <option value="RUMBLE">RUMBLE</option>
                            <option value="MINOR">MINOR</option>
                            <option value="GOOD">GOOD</option>
                        </select>
                        <button onclick="downloadCSV('ML')" style="padding: 2px 5px; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 3px;">Download CSV</button>
                    </div>
                </div>
                <div id="map-ml" class="map-canvas"></div>
            </div>
            <div class="map-box">
                <div class="map-title">
                    ⚙️ Heuristic Logic <br>{counts_html_h}
                    <div style="margin-top: 5px;">
                        <select id="csv-class" style="padding: 2px;">
                            <option value="ALL">ALL</option>
                            <option value="POTHOLE">POTHOLE</option>
                            <option value="BAD">BAD</option>
                            <option value="OBSTACLE">OBSTACLE</option>
                            <option value="HUMP">HUMP</option>
                            <option value="RUMBLE">RUMBLE</option>
                            <option value="MINOR">MINOR</option>
                            <option value="GOOD">GOOD</option>
                        </select>
                        <button onclick="downloadCSV('HEURISTIC')" style="padding: 2px 5px; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 3px;">Download CSV</button>
                    </div>
                </div>
                <div id="map-heuristic" class="map-canvas"></div>
                <div class="legend">
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;"><input type="checkbox" checked onchange="toggleLayer('POTHOLE', this.checked)"> <span style="background: #dc2626;"></span> POTHOLE</label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;"><input type="checkbox" checked onchange="toggleLayer('BAD', this.checked)"> <span style="background: #ef4444;"></span> BAD</label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;"><input type="checkbox" checked onchange="toggleLayer('OBSTACLE', this.checked)"> <span style="background: #a855f7;"></span> OBSTACLE</label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;"><input type="checkbox" checked onchange="toggleLayer('HUMP', this.checked)"> <span style="background: #3b82f6;"></span> HUMP</label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;"><input type="checkbox" checked onchange="toggleLayer('RUMBLE', this.checked)"> <span style="background: #eab308;"></span> RUMBLE</label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;"><input type="checkbox" checked onchange="toggleLayer('MINOR', this.checked)"> <span style="background: #f59e0b;"></span> MINOR</label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;"><input type="checkbox" checked onchange="toggleLayer('GOOD', this.checked)"> <span style="background: #22c55e;"></span> GOOD</label>
                </div>
            </div>
        </div>
        <script>
            var mapM = L.map('map-ml', {{ zoomControl: false }}).setView([{center_lat}, {center_lng}], 16);
            L.tileLayer('https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png', {{ maxZoom: 19 }}).addTo(mapM);

            var mapH = L.map('map-heuristic').setView([{center_lat}, {center_lng}], 16);
            L.tileLayer('https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png', {{ maxZoom: 19 }}).addTo(mapH);

            var route = {route_coords};
            L.polyline(route, {{color: 'blue', weight: 3, opacity: 0.5}}).addTo(mapM);
            L.polyline(route, {{color: 'blue', weight: 3, opacity: 0.5}}).addTo(mapH);

            var layerGroups_mapM = {{}};
            var layerGroups_mapH = {{}};

            {markers_m}
            {markers_h}
            
            function toggleLayer(label, isChecked) {{
                if (layerGroups_mapM[label]) {{
                    if (isChecked) mapM.addLayer(layerGroups_mapM[label]);
                    else mapM.removeLayer(layerGroups_mapM[label]);
                }}
                if (layerGroups_mapH[label]) {{
                    if (isChecked) mapH.addLayer(layerGroups_mapH[label]);
                    else mapH.removeLayer(layerGroups_mapH[label]);
                }}
            }}

            // Sync panning and zooming
            mapM.sync(mapH);
            mapH.sync(mapM);
            
            var events_h_data = {events_json_h};
            var events_m_data = {events_json_m};
            var raw_data = {raw_json};
            
            function downloadCSV(side) {{
                var selectId = side === 'ML' ? 'csv-class-ml' : 'csv-class';
                var data = side === 'ML' ? events_m_data : events_h_data;
                var prefix = side === 'ML' ? 'ml_' : 'heuristic_';
                
                var selectedClass = document.getElementById(selectId).value;
                
                // Get the list of window IDs that match the selected class
                var validWindows = new Set();
                data.forEach(e => {{
                    if (selectedClass === 'ALL' || e.label === selectedClass) {{
                        validWindows.add(e.window_id);
                    }}
                }});
                
                if (validWindows.size === 0) {{
                    alert("No events found for class: " + selectedClass);
                    return;
                }}
                
                // Filter the RAW data by those window IDs
                var filtered = raw_data.filter(r => validWindows.has(r.win_idx));
                
                // Also, let's append the label to the row for clarity
                filtered = filtered.map(r => {{
                    // Find the label for this window_id
                    var ev = data.find(e => e.window_id === r.win_idx);
                    return {{ ...r, label: ev ? ev.label : 'UNKNOWN' }};
                }});
                
                if (filtered.length === 0) {{
                    alert("No raw data found for these windows.");
                    return;
                }}
                
                var keys = Object.keys(filtered[0]);
                var csv = keys.join(",") + "\\n";
                filtered.forEach(function(row) {{
                    var values = keys.map(function(k) {{ return row[k]; }});
                    csv += values.join(",") + "\\n";
                }});
                
                var blob = new Blob([csv], {{ type: 'text/csv;charset=utf-8;' }});
                var link = document.createElement("a");
                var url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", prefix + selectedClass + "_raw_samples.csv");
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }}
        </script>
    </body>
    </html>
    """
    return html

@app.get("/", response_class=HTMLResponse)
async def index():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>GRIP Telemetry Uploader</title>
        <style>
            body { font-family: sans-serif; background: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 500px; width: 100%; }
            h2 { color: #0f172a; margin-top: 0; }
            p { color: #64748b; margin-bottom: 30px; line-height: 1.5; }
            .file-input { margin-bottom: 20px; }
            .btn { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; transition: 0.2s; }
            .btn:hover { background: #2563eb; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>🏎️ GRIP Telemetry Tester</h2>
            <p>Select a raw JSON sensor batch file collected by the mobile app to process and visualize its events on the map using the exact telemetry worker logic.</p>
            <form action="/upload" method="post" enctype="multipart/form-data">
                <input type="file" name="file" accept=".json" class="file-input" required /><br/>
                <div style="margin-bottom: 20px; text-align: left;">
                    <label style="color: #64748b; font-weight: bold;">Vehicle Type:</label>
                    <select name="vehicle_type" style="padding: 8px; width: 100%; margin-top: 5px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        <option value="2_wheeler">2-Wheeler (Bike/Scooter)</option>
                        <option value="4_wheeler">4-Wheeler (Car/Bus)</option>
                    </select>
                </div>
                <button type="submit" class="btn">Process & Visualize</button>
            </form>
        </div>
    </body>
    </html>
    """

@app.post("/upload", response_class=HTMLResponse)
async def upload_file(file: UploadFile = File(...), vehicle_type: str = Form("2_wheeler")):
    try:
        content = await file.read()
        payload = json.loads(content)
        readings = payload.get('readings', [])
        if not readings:
            return "<h3>Error: No readings found in the uploaded JSON file.</h3><a href='/'>Go Back</a>"

        df = pd.DataFrame(readings)
        if df.empty:
            return "<h3>Error: File parsed but dataframe is empty.</h3><a href='/'>Go Back</a>"

        df = df.rename(columns={
            'accelX': 'accel_x', 'accelY': 'accel_y', 'accelZ': 'accel_z',
            'gyroX': 'gyro_x', 'gyroY': 'gyro_y', 'gyroZ': 'gyro_z',
            'lat': 'latitude', 'lng': 'longitude'
        })

        # Apply static multiplier to scale 4-wheeler signals up to match 2-wheeler training data
        if vehicle_type == "4_wheeler":
            factors = {
                "accel_x": 0.5, "accel_y": 0.5, "accel_z": 0.4,
                "gyro_x": 0.6, "gyro_y": 0.6, "gyro_z": 0.7
            }
            for col, k in factors.items():
                if col in df.columns and k != 1.0:
                    df[col] = pd.to_numeric(df[col], errors='coerce') / k

        if 'latitude' in df.columns and 'longitude' in df.columns:
            df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
            df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')

        if 'speed' in df.columns:
            df['speed'] = pd.to_numeric(df['speed'], errors='coerce')
            df = df[df['speed'] >= 2.0]

        events_heuristic, df_h = classify_dataframe(
            df,
            min_samples=50,
            use_gyro=True,
            axis_mode='gyro'
        )
        
        events_ml, df_m = classify_dataframe_ml(
            df,
            min_speed_kph=5.0
        )

        return build_html_map(readings, events_heuristic, events_ml, df_h)
    except Exception as e:
        return f"<h3>Processing Error: {e}</h3><br><a href='/'>Go Back</a>"

def open_browser():
    webbrowser.open("http://127.0.0.1:5018")

if __name__ == "__main__":
    print("Starting Web Telemetry Tester...")
    Timer(1.5, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=5018)
