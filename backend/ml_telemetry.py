import os
import json
import numpy as np
import pandas as pd
from scipy.stats import kurtosis, skew
import joblib
from telemetry import vertical_from_gyro_and_accel

# Determine base path for models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, '..', 'models')

# Load the RF model and label encoder lazily
_rf_model = None
_label_encoder = None
_feature_names = None

def _load_models():
    global _rf_model, _label_encoder, _feature_names
    if _rf_model is None:
        try:
            _rf_model = joblib.load(os.path.join(MODELS_DIR, 'road_classifier.joblib'))
            _label_encoder = joblib.load(os.path.join(MODELS_DIR, 'label_encoder.joblib'))
            with open(os.path.join(MODELS_DIR, 'feature_names.json'), 'r') as f:
                _feature_names = json.load(f)
        except Exception as e:
            print(f"ML Model Load Error: {e}")
            raise

def extract_features(win, feature_names, fs=70.0):
    """Extract exactly the 103 features expected by the random forest model."""
    
    feats = {}
    sensor_cols = ["accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"]
    
    # Check if all cols exist
    for col in sensor_cols:
        if col not in win.columns:
            win[col] = 0.0
            
    data = win[sensor_cols].values.astype(float)   # shape (N, 6)
    sample_interval = 0.011 # EXACT match from config.py in training
    
    from scipy.fft import rfft, rfftfreq
    from scipy import stats
    
    for i, col in enumerate(sensor_cols):
        sig = data[:, i]
        p = col   # prefix

        # ── Time-domain ──────────────────────────────────────────────
        feats[f"{p}_mean"]     = float(np.mean(sig)) if len(sig) else 0.0
        feats[f"{p}_std"]      = float(np.std(sig)) if len(sig) else 0.0
        feats[f"{p}_min"]      = float(np.min(sig)) if len(sig) else 0.0
        feats[f"{p}_max"]      = float(np.max(sig)) if len(sig) else 0.0
        feats[f"{p}_range"]    = float(np.ptp(sig)) if len(sig) else 0.0
        feats[f"{p}_rms"]      = float(np.sqrt(np.mean(sig ** 2))) if len(sig) else 0.0
        feats[f"{p}_kurtosis"] = float(stats.kurtosis(sig)) if len(sig) > 3 else 0.0
        feats[f"{p}_skew"]     = float(stats.skew(sig)) if len(sig) > 3 else 0.0
        feats[f"{p}_zcr"]      = int(((sig[:-1] * sig[1:]) < 0).sum()) if len(sig) > 1 else 0

        # ── Jerk (accel axes only) ────────────────────────────────────
        if col.startswith("accel"):
            jerk = np.diff(sig) if len(sig) > 1 else np.zeros(1)
            feats[f"{p}_jerk_max"] = float(np.max(np.abs(jerk))) if len(jerk) else 0.0
            feats[f"{p}_jerk_std"] = float(np.std(jerk)) if len(jerk) else 0.0
            feats[f"{p}_jerk_rms"] = float(np.sqrt(np.mean(jerk ** 2))) if len(jerk) else 0.0

        # ── Frequency domain ─────────────────────────────────────────
        N = len(sig)
        if N >= 8:
            fft_mag = np.abs(rfft(sig - sig.mean()))[:N // 2]
            freqs   = rfftfreq(N, d=sample_interval)[:N // 2]
            if len(fft_mag) > 0:
                feats[f"{p}_fft_dom_freq"]       = float(freqs[np.argmax(fft_mag)]) if len(freqs) else 0.0
                feats[f"{p}_fft_energy_low"]     = float(np.sum(fft_mag[freqs < 2]  ** 2))
                feats[f"{p}_fft_energy_mid"]     = float(np.sum(fft_mag[(freqs >= 2) & (freqs < 10)] ** 2))
                feats[f"{p}_fft_energy_high"]    = float(np.sum(fft_mag[freqs >= 10] ** 2))
                feats[f"{p}_fft_spectral_centroid"] = float(
                    np.sum(freqs * fft_mag) / (np.sum(fft_mag) + 1e-9)
                )
        else:
            feats[f"{p}_fft_dom_freq"] = 0.0
            feats[f"{p}_fft_energy_low"] = 0.0
            feats[f"{p}_fft_energy_mid"] = 0.0
            feats[f"{p}_fft_energy_high"] = 0.0
            feats[f"{p}_fft_spectral_centroid"] = 0.0

    # ── Resultant magnitudes ──────────────────────────────────────────
    if len(data) > 0:
        mag = np.sqrt(data[:, 0]**2 + data[:, 1]**2 + data[:, 2]**2)
        feats["accel_mag_mean"]      = float(np.mean(mag))
        feats["accel_mag_std"]       = float(np.std(mag))
        feats["accel_mag_max"]       = float(np.max(mag))
        feats["accel_mag_kurtosis"]  = float(stats.kurtosis(mag)) if len(mag) > 3 else 0.0
        feats["accel_mag_rms"]       = float(np.sqrt(np.mean(mag ** 2)))

        gyro_mag = np.sqrt(data[:, 3]**2 + data[:, 4]**2 + data[:, 5]**2)
        feats["gyro_mag_mean"] = float(np.mean(gyro_mag))
        feats["gyro_mag_std"]  = float(np.std(gyro_mag))
        feats["gyro_mag_max"]  = float(np.max(gyro_mag))
    else:
        feats["accel_mag_mean"] = 0.0
        feats["accel_mag_std"] = 0.0
        feats["accel_mag_max"] = 0.0
        feats["accel_mag_kurtosis"] = 0.0
        feats["accel_mag_rms"] = 0.0
        feats["gyro_mag_mean"] = 0.0
        feats["gyro_mag_std"] = 0.0
        feats["gyro_mag_max"] = 0.0

    feats["window_n_samples"] = int(len(win))
    
    # Return list matching EXACT order of feature_names JSON
    return [feats.get(name, 0.0) for name in feature_names]

def classify_dataframe_ml(df, min_speed_kph=5.0):
    """Main entrypoint for ML prediction pipeline. Works identically to telemetry.classify_dataframe"""
    _load_models()
    
    if df.empty:
        return [], df
        
    df = df.copy()
    if 'timestamp' not in df.columns:
        return [], df
        
    df['timestamp'] = pd.to_numeric(df['timestamp'], errors='coerce')
    df = df.dropna(subset=['timestamp']).reset_index(drop=True)
    tms = df['timestamp'].astype(float).values
    t0 = tms[0]
    df['time_s'] = (tms - t0) / 1000.0
    df['win_idx'] = (df['time_s'] // 1.0).astype(int)
    
    events = []
    
    # Process each 1-second window
    grouped = df.groupby('win_idx')
    
    features_list = []
    win_data_list = []
    
    for win_idx, win in grouped:
        samples = len(win)
        if samples < 15: # Need enough samples for FFT/Stats (Lowered from 30 to prevent dropping data during lag)
            continue
            
        # Optional: Skip slow speeds
        if 'speed' in win.columns:
            sp = win['speed'].astype(float).values
            avg_speed = np.nanmean(sp) if not np.isnan(sp).all() else 0.0
            if avg_speed > 0 and avg_speed < min_speed_kph:
                # We can still predict, but maybe the heuristic skips it. Let's let the ML decide or skip if required.
                pass
        
        # --- ORIENTATION FIX ---
        # Apply Complementary Filter to isolate Earth-frame vertical and lateral axes
        win = win.copy()
        vert, hx, hy, hz, yaw_rate = vertical_from_gyro_and_accel(win, return_all=True)
        win['accel_z'] = vert  # True vertical bounce
        win['accel_x'] = hx    # True lateral X
        win['accel_y'] = hy    # True lateral Y
        
        # Calculate features
        feat_row = extract_features(win, _feature_names)
        features_list.append(feat_row)
        
        win_start_ms = win['timestamp'].iloc[0]
        mean_lat = np.nanmean(win['latitude'].astype(float).values) if 'latitude' in win.columns else float('nan')
        mean_lon = np.nanmean(win['longitude'].astype(float).values) if 'longitude' in win.columns else float('nan')
        
        win_data_list.append({
            'win_idx': int(win_idx),
            'timestamp': win_start_ms,
            'latitude': float(mean_lat),
            'longitude': float(mean_lon),
            'samples': samples,
        })
        
    if not features_list:
        return [], df
        
    # Batch predict
    X = np.array(features_list)
    # Handle NaNs from Kurtosis/Skew
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    X_df = pd.DataFrame(X, columns=_feature_names)
    
    y_pred = _rf_model.predict(X_df)
    labels = _label_encoder.inverse_transform(y_pred)
    
    colors = {
        'POTHOLE': '#dc2626',
        'BAD': '#ef4444',
        'OBSTACLE': '#a855f7',
        'HUMP': '#3b82f6',
        'RUMBLE': '#eab308',
        'MINOR': '#f59e0b',
        'GOOD': '#22c55e'
    }
    
    # Map predictions back to events array format expected by the frontend
    for wd, label in zip(win_data_list, labels):
        # We also need vibration_intensity for the popup, we can use a dummy value or compute accel_rms
        events.append({
            'session': '',
            'window_id': wd['win_idx'],
            'timestamp': wd['timestamp'],
            'latitude': wd['latitude'],
            'longitude': wd['longitude'],
            'avg_speed_kph': 0.0,
            'speed': 0.0,
            'vibration_intensity': 0.0, # Not strictly used by map color, just popup
            'lateral_variance': 0.0,
            'label': label,
            'color_hex': colors.get(label, '#22c55e'),
            'samples': wd['samples']
        })
        
    return events, df
