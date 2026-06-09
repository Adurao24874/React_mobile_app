# GRIP Telemetry API Documentation

This document explains the telemetry parameters used for passive monitoring (e.g., automatic pothole and road condition detection) in the GRIP platform. 

The mobile app collects sensor data while users are driving or walking and periodically uploads it to the backend via the `/upload/sensors` endpoint.

---

## 📡 Endpoint Details
- **URL**: `/upload/sensors`
- **Method**: `POST`
- **Content-Type**: `application/json`

---

## 📦 Payload Structure

The endpoint expects a `SensorBatch` JSON object containing an array of individual sensor readings.

### `SensorBatch` (The Main Request Body)
| Parameter  | Type | Description |
|------------|------|-------------|
| `id`       | `string` | A unique identifier (UUID) for this specific batch of telemetry data. Used for logging and saving the raw JSON file to the server. |
| `readings` | `array` | A list of `SensorReading` objects representing the data collected over a period of time. |

### `SensorReading` (Individual Data Points)
Each item in the `readings` array contains the physical telemetry collected at a specific millisecond:

| Parameter   | Type | Required? | Description |
|-------------|------|-----------|-------------|
| `accelZ`    | `float` | **Yes** | The vertical acceleration (Z-axis) of the device. This is the primary metric used to detect physical impacts, sudden drops, or harsh bumps (e.g., driving over a pothole). |
| `gyroX`     | `float` | **Yes** | Device rotation around the X-axis (Pitch). Useful for understanding if the vehicle suddenly tilted forward/backward during an impact. |
| `gyroY`     | `float` | **Yes** | Device rotation around the Y-axis (Roll). Useful for understanding side-to-side tilting. |
| `gyroZ`     | `float` | **Yes** | Device rotation around the Z-axis (Yaw). Useful for understanding sudden steering or turning movements. |
| `lat`       | `float` | *Optional* | The GPS Latitude coordinate at the time of the reading. Used to pinpoint exactly where a road defect is located. |
| `lng`       | `float` | *Optional* | The GPS Longitude coordinate at the time of the reading. |
| `timestamp` | `int` | **Yes** | Unix timestamp in milliseconds indicating the exact moment the reading was recorded. Used to plot the readings chronologically. |

---

## 🚀 Example Request

```json
{
  "id": "batch-8f92a1-432b-9c2d",
  "readings": [
    {
      "accelZ": 12.45,
      "gyroX": 0.02,
      "gyroY": -0.01,
      "gyroZ": 0.05,
      "lat": 15.3965,
      "lng": 74.0089,
      "timestamp": 1779948396669
    },
    {
      "accelZ": 18.92,
      "gyroX": 0.15,
      "gyroY": -0.04,
      "gyroZ": 0.01,
      "lat": 15.3966,
      "lng": 74.0090,
      "timestamp": 1779948396700
    }
  ]
}
```

---

## 🧠 How Telemetry is Processed (Algorithm Logic)

When a batch of telemetry reaches the backend, the raw sensor data is run through a comprehensive signal processing pipeline in `telemetry.py` to classify road anomalies (like Potholes, Speed Humps, and Rumble Strips).

Here is exactly how the backend determines what the road condition is based on the data:

### 1. Sensor Fusion & Gravity Removal
Before analysis, the `vertical_from_gyro_and_accel` function combines the 3-axis accelerometer (`accelZ`, `accelY`, `accelX`) with the gyroscope data (`gyroX`, `gyroY`, `gyroZ`).
Because the phone might be mounted at a weird angle on the dashboard, the gyroscope rotation matrix allows the system to isolate the **true vertical acceleration** relative to the earth. A High-Pass Filter (`apply_highpass`) is then applied to mathematically subtract the continuous 1G force of gravity so the baseline rests at 0.

### 2. Dynamic Thresholding (Anomaly Scoring)
Roads are naturally bumpy, so a static threshold won't work. The system uses a `RingBufferWindow` to track the rolling mean and standard deviation of recent vertical vibrations. 
The `compute_anomaly_score` function triggers an "event" only when a sudden impact significantly exceeds the recent historical baseline (e.g., a sudden 5G spike on an otherwise smooth road).

### 3. Anomaly Classification (Shape Recognition & Exact Thresholds)
Once an impact spike is detected, the algorithm analyzes the "shape" of the vertical acceleration wave over a 1-second window. The system uses the following exact thresholds (found in `telemetry.py`):

- 🕳️ **Potholes (`asymmetry_score_z`)**: A pothole causes the wheel to drop suddenly, followed by a violent upward strike. The algorithm looks for a sharp negative `accelZ` spike followed immediately by a sharp positive rebound.
  - **Minor Pothole Threshold**: `> 2.0` anomaly score.
  - **Severe Pothole Threshold**: `> 3.5` anomaly score.
  - *Note: To prevent false positives while stopped at a red light, anomalies are ignored if the GPS speed is `< 5.0 km/h`.*

- 🚧 **Speed Humps (`symmetry_score_z`)**: A speed hump pushes the car upward first, then lets it drop down. The algorithm looks for the exact opposite of a pothole: a positive `accelZ` peak followed by a negative trough.
  - **Peak Threshold (`hump_peak_thresh`)**: `> 3.0`. The initial upward spike must cross this value.
  - **Magnitude Override (`hump_mag_thresh`)**: `> 18.0`. If a vehicle hits a speed hump so hard that the raw acceleration exceeds 18.0, it automatically forces a speed hump classification regardless of the wave symmetry.

- 〰️ **Rumble Strips (`detect_rumble_fft`)**: Rumble strips don't cause single massive spikes; they cause high-frequency, continuous vibration. The system runs a **Fast Fourier Transform (FFT)** to convert the time-domain data into frequencies. If it detects a tight cluster of rhythmic energy (between 10Hz-40Hz), it classifies it as a rumble strip.
  - **FFT Coefficient of Variation (`fft_cv_thresh`)**: `< 0.25`. If the mathematical variance of the frequency energy is below 0.25, it means the vibration is highly rhythmic and repetitive (a guaranteed rumble strip).

### 4. Vibration Intensity (RMS)
For the general "Road Quality" index, the `compute_vibration_rms` function calculates the Root Mean Square of all 3 axes to determine the overall baseline roughness of the road segment, saving it to the database for spatial heatmapping.

## 🛠️ How It Works in the Backend
1. **Reception**: The FastAPI backend receives the JSON batch.
2. **Local Storage**: It saves the full batch payload to disk at `uploads/sensors/{batch.id}.json` for archival and deep analytics.
3. **Database Logging**: It logs a summary of the batch into the Supabase `sensors` table (batch ID, count of readings, and timestamp).
4. **Analysis (Worker)**: Background workers can then process these raw acceleration spikes to calculate road quality indexes, mapping specific high-G-force `accelZ` impacts to their corresponding GPS coordinates to automatically detect unmarked potholes.
