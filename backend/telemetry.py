#!/usr/bin/env python3
"""Classify 1s windows in session CSVs into road-condition labels.

Usage:
  python classify_session_windows.py --in sample_sensor_data.csv --out events_labeled.csv

Outputs per-window CSV with columns: session, window_start_ms, latitude, longitude, vibration_intensity,
anomaly_score, label, color_hex, samples, avg_speed_kph

This is an offline classifier independent of any mobile app logic.
"""
import argparse
import math
import csv
import os
from collections import deque, defaultdict

import numpy as np
import pandas as pd

# Color mapping per spec
COLOR_MAP = {
    'GOOD': '#2E7D32',
    'MINOR': '#FBC02D',
    'BAD': '#FF3D00',
    'POTHOLE': '#E31A1C',
    'HUMP': '#FDBF6F',
    'RUMBLE': '#FF7F00',
    'UNKNOWN': '#9E9E9E',
}


def haversine_meters(lat1, lon1, lat2, lon2):
    # approx haversine
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2.0)**2
    return 2*R*math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0-a)))


def apply_highpass(x, dt=0.01, fc=1.0):
    # y[n] = a*(y[n-1] + x[n] - x[n-1])
    if len(x) == 0:
        return np.array([])
    a = 1.0 / (1.0 + (2.0 * math.pi * fc * dt))
    y = np.zeros_like(x)
    y_prev = 0.0
    x_prev = x[0]
    for i, xi in enumerate(x):
        yv = a * (y_prev + xi - x_prev)
        y[i] = yv
        y_prev = yv
        x_prev = xi
    return y


def compute_vibration_rms(xf, yf, zf):
    mag = np.sqrt(xf**2 + yf**2 + zf**2)
    return float(np.sqrt(np.mean(mag**2)))


class RingBufferWindow:
    def __init__(self, capacity=50):
        self.capacity = int(capacity)
        self.buf = deque(maxlen=self.capacity)

    def push(self, v):
        self.buf.append(float(v))

    def size(self):
        return len(self.buf)

    def mean(self):
        if not self.buf:
            return 0.0
        return float(np.mean(self.buf))

    def std(self):
        if not self.buf:
            return 0.0
        return float(np.std(self.buf, ddof=0))


def compute_anomaly_score(current, buffer: RingBufferWindow):
    if buffer.size() < 10:
        return 0.0
    mu = buffer.mean()
    sigma = buffer.std()
    if sigma <= 0:
        return 0.0
    return max(0.0, (current - mu) / sigma)


def symmetry_score_z(z):
    # compute Pearson correlation between first half and reversed second half
    z = np.asarray(z)
    if z.ndim == 0:
        z = z.reshape(1)
    n = z.size
    if n < 4:
        return 0.0
    mid = n // 2
    a = z[:mid]
    b = z[mid:mid+len(a)]
    if len(b) != len(a) or len(a) < 2:
        return 0.0
    b_rev = b[::-1]
    # Normalize
    a = (a - np.mean(a))
    b_rev = (b_rev - np.mean(b_rev))
    denom = (np.linalg.norm(a) * np.linalg.norm(b_rev))
    if denom == 0:
        return 0.0
    corr = float(np.dot(a, b_rev) / denom)
    # map corr [-1,1] to [0,1]
    return (corr + 1.0) / 2.0


def asymmetry_score_z(z):
    return 1.0 - symmetry_score_z(z)


def detect_rumble_fft(mag, sample_rate, fft_cv_thresh=0.25):
    # Use window length 128; zero-pad or truncate
    N = 128
    if len(mag) < 8:
        return False
    x = np.array(mag, dtype=float)
    if len(x) < N:
        x = np.pad(x, (0, N - len(x)), mode='constant')
    else:
        x = x[:N]
    # apply Hann
    hann = np.hanning(N)
    xw = x * hann
    spec = np.abs(np.fft.rfft(xw))
    freqs = np.fft.rfftfreq(N, d=1.0 / sample_rate)
    # focus on 5-50 Hz
    band_mask = (freqs >= 5.0) & (freqs <= 50.0)
    band_spec = spec * band_mask
    # find local peaks: simple neighbor compare
    peaks = []
    for i in range(1, len(band_spec) - 1):
        if band_spec[i] > band_spec[i - 1] and band_spec[i] > band_spec[i + 1] and band_spec[i] > 0:
            peaks.append(freqs[i])
    if len(peaks) < 3:
        return False
    # check regular spacing
    peaks = np.array(peaks)
    diffs = np.diff(np.sort(peaks))
    if len(diffs) < 2:
        return False
    mean_diff = np.mean(diffs)
    if mean_diff <= 0:
        return False
    cv = float(np.std(diffs) / mean_diff)
    # require reasonably regular spacing (cv small)
    return (cv < float(fft_cv_thresh))


def get_vertical_accel(df_win, axis_mode='auto', default_fs=100.0):
    """Return an array representing the estimated vertical acceleration for a window.
    axis_mode: 'gyro'|'projected'|'linear'|'z'|'mag'|'auto'
    """
    # prefer linear accel column when available
    if axis_mode in ('linear', 'auto') and 'linear_accel_z' in df_win.columns:
        return df_win['linear_accel_z'].astype(float).to_numpy()
    if axis_mode == 'z' and 'accel_z' in df_win.columns:
        return df_win['accel_z'].astype(float).to_numpy()
    if axis_mode == 'mag' and {'accel_x','accel_y','accel_z'}.issubset(df_win.columns):
        ax = df_win['accel_x'].astype(float).to_numpy(); ay = df_win['accel_y'].astype(float).to_numpy(); az = df_win['accel_z'].astype(float).to_numpy()
        return np.sqrt(ax*ax + ay*ay + az*az)
    # auto fallback to accel_z when available
    if axis_mode == 'auto' and 'accel_z' in df_win.columns:
        return df_win['accel_z'].astype(float).to_numpy()
    # last resort: try projection using low-pass accel to estimate gravity direction
    if {'accel_x','accel_y','accel_z'}.issubset(df_win.columns):
        ax = df_win['accel_x'].astype(float)
        ay = df_win['accel_y'].astype(float)
        az = df_win['accel_z'].astype(float)
        alpha = 0.02
        gx = ax.ewm(alpha=alpha).mean().to_numpy()
        gy = ay.ewm(alpha=alpha).mean().to_numpy()
        gz = az.ewm(alpha=alpha).mean().to_numpy()
        gnorm = np.sqrt(gx*gx + gy*gy + gz*gz)
        gnorm[gnorm==0] = 1.0
        axn = ax.to_numpy(); ayn = ay.to_numpy(); azn = az.to_numpy()
        return (axn*gx + ayn*gy + azn*gz) / gnorm
    return np.zeros(len(df_win), dtype=float)


def vertical_from_gyro_and_accel(df_win, time_col='time_s', accel_cols=('accel_x','accel_y','accel_z'), gyro_cols=('gyro_x','gyro_y','gyro_z'), accel_correction=0.02, fs_default=100.0):
    """Estimate gravity axis using a simple complementary-style filter (gyro integration + accel correction)
    and return the vertical linear acceleration (gravity removed, signed downward negative).
    This is a lightweight approach that works well when gyro is present.
    """
    if not set(accel_cols).issubset(df_win.columns):
        return get_vertical_accel(df_win, axis_mode='auto', default_fs=fs_default)
    ax = df_win[accel_cols[0]].astype(float).to_numpy()
    ay = df_win[accel_cols[1]].astype(float).to_numpy()
    az = df_win[accel_cols[2]].astype(float).to_numpy()
    has_gyro = set(gyro_cols).issubset(df_win.columns)
    gx = df_win[gyro_cols[0]].astype(float).to_numpy() if has_gyro else None
    gy = df_win[gyro_cols[1]].astype(float).to_numpy() if has_gyro else None
    gz = df_win[gyro_cols[2]].astype(float).to_numpy() if has_gyro else None

    if time_col in df_win.columns:
        t = df_win[time_col].astype(float).to_numpy()
        dt = np.diff(t, prepend=t[0])
        dt[dt <= 0] = 1.0 / fs_default
    else:
        dt = np.full(len(ax), 1.0 / fs_default)

    # initial gravity estimate from first accel sample
    g_vec = np.array([ax[0], ay[0], az[0]], dtype=float)
    out_vertical = np.zeros_like(ax)
    for i in range(len(ax)):
        acc_vec = np.array([ax[i], ay[i], az[i]], dtype=float)
        if has_gyro:
            omega = np.array([gx[i], gy[i], gz[i]], dtype=float)
            g_vec = g_vec + np.cross(omega, g_vec) * dt[i]
        acc_norm = np.linalg.norm(acc_vec)
        if acc_norm > 1e-6:
            acc_dir = acc_vec / acc_norm
            g_dir = g_vec / (np.linalg.norm(g_vec) + 1e-12)
            g_dir = (1.0 - accel_correction) * g_dir + accel_correction * acc_dir
            g_dir = g_dir / (np.linalg.norm(g_dir) + 1e-12)
            g_vec = g_dir * acc_norm
        linear = acc_vec - g_vec
        g_unit = g_vec / (np.linalg.norm(g_vec) + 1e-12)
        # vertical acceleration: projection of linear accel onto gravity axis, negate so downward is negative
        vert = -float(np.dot(linear, g_unit))
        out_vertical[i] = vert
    return out_vertical


def to_label(severity_label, is_pothole, is_hump, is_rumble, window_valid=True):
    if not window_valid:
        return 'UNKNOWN'
    if is_pothole:
        return 'POTHOLE'
    if is_hump:
        return 'HUMP'
    if is_rumble:
        return 'RUMBLE'
    if severity_label == 'BAD':
        return 'BAD'
    if severity_label == 'MINOR':
        return 'MINOR'
    return 'GOOD'


def classify_dataframe(
    df: pd.DataFrame,
    min_samples: int = 50,
    min_speed_kph: float = 0.0,
    elev_multiplier: float = 3.0,
    fft_cv_thresh: float = 0.25,
    minor_thresh: float = 2.0,
    bad_thresh: float = 3.5,
    use_gyro: bool = False,
    gyro_scale: float = 0.1,
    peak_center_window_s: float = 2.0,
    rtp_pothole_ratio: float = 1.5,
    hump_peak_thresh: float = 4.05,
    hump_mag_thresh: float = 25.0,
    min_trough_abs: float = 4.0,
    min_peak_abs: float = 4.0,
    axis_mode: str = 'gyro',
):
    """Classify a dataframe of samples into per-window events.
    Returns (events_list, processed_df)
    """
    # Expect timestamp in ms; accel_x/y/z; latitude, longitude
    if 'timestamp' not in df.columns:
        raise ValueError('input dataframe must have timestamp column')
    # ensure numeric
    df = df.copy()
    # ignore any pre-computed fields in the CSV — compute speed, vibration, anomaly ourselves
    for _drop in ['speed','vibration_intensity','anomaly_score']:
        if _drop in df.columns:
            try:
                df = df.drop(columns=[_drop])
            except Exception:
                pass
    df['timestamp'] = pd.to_numeric(df['timestamp'], errors='coerce')
    df = df.dropna(subset=['timestamp']).reset_index(drop=True)
    tms = df['timestamp'].astype(float).values
    t0 = tms[0]
    times_s = (tms - t0) / 1000.0
    df['time_s'] = times_s
    # Expect timestamp in ms; accel_x/y/z; latitude, longitude
    if 'timestamp' not in df.columns:
        raise ValueError('input CSV must have timestamp column')
    tms = df['timestamp'].astype(float).values
    t0 = tms[0]
    times_s = (tms - t0) / 1000.0
    df['time_s'] = times_s

    # guess sample rate
    dts = np.diff(times_s)
    if len(dts) == 0:
        print('no samples')
        return
    median_dt = float(np.median(dts))
    sample_rate = 1.0 / median_dt if median_dt > 0 else 100.0

    # Prefer CSV-provided window_id when present and numeric (some producers embed window indices
    # while timestamps may be coarse or identical). If not available, fall back to 1s windows from time_s.
    if 'window_id' in df.columns:
        try:
            # coerce to numeric then to int, and normalize to start at 0
            winvals = pd.to_numeric(df['window_id'], errors='coerce')
            if winvals.notna().all():
                # map to zero-based contiguous ints
                minwin = int(np.nanmin(winvals))
                df['win_idx'] = (winvals.astype(int) - minwin).astype(int)
            else:
                df['win_idx'] = (df['time_s'] // 1.0).astype(int)
        except Exception:
            df['win_idx'] = (df['time_s'] // 1.0).astype(int)
    else:
        # window index by integer seconds from start (1.0s windows aligned to t0)
        df['win_idx'] = (df['time_s'] // 1.0).astype(int)

    # precompute per-sample speed (km/h) using haversine between consecutive GPS
    lat = df['latitude'].astype(float).values if 'latitude' in df.columns else np.full(len(df), np.nan)
    lon = df['longitude'].astype(float).values if 'longitude' in df.columns else np.full(len(df), np.nan)
    speed_mps = np.zeros(len(df))
    speed_mps[:] = np.nan
    for i in range(1, len(df)):
        if math.isnan(lat[i]) or math.isnan(lat[i-1]):
            continue
        dist = haversine_meters(lat[i-1], lon[i-1], lat[i], lon[i])
        dt = times_s[i] - times_s[i-1]
        if dt <= 0:
            continue
        speed_mps[i] = dist / dt
    speed_kph = speed_mps * 3.6
    df['speed_kph'] = speed_kph

    # buffers and results
    rb = RingBufferWindow(capacity=50)
    rows_out = []

    grouped = df.groupby('win_idx')
    for win_idx, win in grouped:
        samples = len(win)
        win_start_ms = int(win['timestamp'].iloc[0])
        # sample count condition
        # compute avg speed in window excluding NaNs
        # robust avg_speed: avoid RuntimeWarning when all values are NaN
        if samples > 0 and 'speed_kph' in win.columns:
            sp = win['speed_kph'].values.astype(float)
            if np.isnan(sp).all():
                avg_speed = float('nan')
            else:
                avg_speed = float(np.nanmean(sp))
        else:
            avg_speed = float('nan')
        # window is valid if it meets sample count and (if speed data exists and >0) meets speed threshold
        window_valid = True
        if samples < int(min_samples):
            window_valid = False
        else:
            # Only enforce speed threshold when avg_speed is finite and > 0
            if np.isfinite(avg_speed) and avg_speed > 0 and avg_speed < float(min_speed_kph):
                window_valid = False

        # prepare accel arrays
        ax = win['accel_x'].astype(float).values if 'accel_x' in win.columns else np.zeros(samples)
        ay = win['accel_y'].astype(float).values if 'accel_y' in win.columns else np.zeros(samples)
        az = win['accel_z'].astype(float).values if 'accel_z' in win.columns else np.zeros(samples)
        # compute per-sample dt from local times (use median)
        if samples >= 2:
            local_dts = np.diff(win['time_s'].values.astype(float))
            # prefer positive deltas only (ignore zeros from degenerate timestamps)
            pos_dts = local_dts[local_dts > 0]
            if pos_dts.size:
                local_dt = float(np.median(pos_dts))
            else:
                # fallback: estimate dt from window length assuming ~1s windows
                local_dt = (1.0 / float(samples)) if samples > 0 else (median_dt if median_dt > 0 else 0.01)
        else:
            local_dt = median_dt if median_dt > 0 else (1.0 / float(samples) if samples > 0 else 0.01)

        # apply high-pass to accelerometer per-axis
        xf = apply_highpass(ax, dt=local_dt, fc=1.0)
        yf = apply_highpass(ay, dt=local_dt, fc=1.0)
        zf = apply_highpass(az, dt=local_dt, fc=1.0)

        # compute vertical component according to axis_mode
        try:
            if axis_mode in ('gyro', 'projected'):
                v_raw = vertical_from_gyro_and_accel(win, time_col='time_s')
            else:
                v_raw = get_vertical_accel(win, axis_mode=axis_mode)
            # coerce to 1-D numeric numpy array and ensure length matches
            v_raw = np.array(v_raw, dtype=float, copy=False)
            v_raw = np.atleast_1d(v_raw)
            if v_raw.size != samples:
                v_raw = np.resize(v_raw, samples)
        except Exception:
            v_raw = zf.copy()

        # high-pass the vertical signal as well to focus on transient
        try:
            v = apply_highpass(np.array(v_raw, dtype=float), dt=local_dt, fc=1.0)
        except Exception:
            v = zf
        # ensure v is a 1-D numeric array (avoid numpy scalar/bool results)
        try:
            v = np.asarray(v, dtype=float)
            v = np.atleast_1d(v)
        except Exception:
            v = np.asarray(zf, dtype=float)

        # optionally include gyroscope-derived vibration
        if use_gyro and ('gyro_x' in win.columns or 'gyro_y' in win.columns or 'gyro_z' in win.columns):
            gx = win['gyro_x'].astype(float).values if 'gyro_x' in win.columns else np.zeros(samples)
            gy = win['gyro_y'].astype(float).values if 'gyro_y' in win.columns else np.zeros(samples)
            gz = win['gyro_z'].astype(float).values if 'gyro_z' in win.columns else np.zeros(samples)
            # high-pass gyro (lower fc to capture lower-frequency rotations?) keep fc=0.5
            gxf = apply_highpass(gx, dt=local_dt, fc=0.5)
            gyf = apply_highpass(gy, dt=local_dt, fc=0.5)
            gzf = apply_highpass(gz, dt=local_dt, fc=0.5)
            gyro_rms = compute_vibration_rms(gxf, gyf, gzf)
            accel_rms = compute_vibration_rms(xf, yf, zf)
            # combine accel and gyro RMS; gyro_scale maps gyro units to accel-like scale (tunable)
            vibration = float(np.sqrt(accel_rms**2 + (gyro_scale * gyro_rms)**2))
        else:
            vibration = compute_vibration_rms(xf, yf, zf)
        anomaly = compute_anomaly_score(vibration, rb)
        # only push valid windows into buffer
        if window_valid:
            rb.push(vibration)

        # detect patterns
        # threshold for elevated activity: magnitude > mean + elev_multiplier*std (within window)
        mag = np.sqrt(xf**2 + yf**2 + zf**2)
        if len(mag) >= 2:
            mag_mean = float(np.mean(mag))
            mag_std = float(np.std(mag))
        else:
            mag_mean = 0.0
            mag_std = 0.0
        # compute raw magnitude peak for hump-mag rule (use raw accel, not high-passed)
        try:
            peak_raw_mag = float(np.max(np.sqrt(ax*ax + ay*ay + az*az))) if samples > 0 else 0.0
        except Exception:
            peak_raw_mag = 0.0
        elevated_mask = mag > (mag_mean + float(elev_multiplier) * (mag_std if mag_std > 0 else 0.001))
        # measure contiguous elevated durations
        elevated_durations = []
        cur_len = 0
        for v in elevated_mask:
            if v:
                cur_len += 1
            else:
                if cur_len > 0:
                    elevated_durations.append(cur_len * local_dt)
                    cur_len = 0
        if cur_len > 0:
            elevated_durations.append(cur_len * local_dt)
        longest_elev = max(elevated_durations) if elevated_durations else 0.0

        pothole = False
        hump = False
        # Prepare a centered subwindow around the dominant transient (peak of abs(vertical))
        try:
            center_samples = int(max(1, round((peak_center_window_s) * (1.0/local_dt)))) if peak_center_window_s>0 else int(np.size(v))
        except Exception:
            center_samples = int(np.size(v))
        if center_samples < 3:
            center_samples = int(np.size(v))
        if np.size(v) > 0:
            v_arr = np.asarray(v)
            if v_arr.ndim == 0:
                v_arr = v_arr.reshape(1)
            abs_v = np.abs(v_arr)
            peak_idx = int(np.argmax(abs_v))
            half = center_samples // 2
            sidx = max(0, peak_idx - half)
            eidx = min(int(np.size(v_arr)), peak_idx + half + 1)
            v_sub = v_arr[sidx:eidx]
        else:
            v_sub = v

        # compute features on subwindow
        P_val = float(np.max(v_sub)) if len(v_sub)>0 else 0.0
        P_idx = int(np.argmax(v_sub)) if len(v_sub)>0 else 0
        T_val = float(np.min(v_sub)) if len(v_sub)>0 else 0.0
        T_idx = int(np.argmin(v_sub)) if len(v_sub)>0 else 0
        # compute trough-to-peak ratio safely (T negative; P positive)
        if abs(P_val) < 1e-8:
            rtp = float('inf') if T_val < 0 else 0.0
        else:
            rtp = float(T_val / P_val)
        # skew/kurtosis for v_sub (vertical signal)
        try:
            zmean = np.mean(v_sub) if len(v_sub)>0 else 0.0
            zstd = np.std(v_sub, ddof=0) if len(v_sub)>0 else 0.0
            skew_z = float(np.mean((v_sub - zmean)**3) / (zstd**3)) if zstd>0 else 0.0
            kurt_z = float(np.mean((v_sub - zmean)**4) / (zstd**4)) if zstd>0 else 0.0
        except Exception:
            skew_z = 0.0; kurt_z = 0.0
        # max jerk (derivative of vertical accel) magnitude
        try:
            jerk = np.diff(v_sub) / local_dt if len(v_sub) > 1 else np.array([0.0])
            jerk_max = float(np.max(np.abs(jerk))) if len(jerk)>0 else 0.0
        except Exception:
            jerk_max = 0.0
        rumble = False
        # Pothole: elevated activity <0.30s and asymmetric z OR large trough-to-peak ratio in the subwindow
        if longest_elev > 0 and longest_elev < 0.30:
            asymz = asymmetry_score_z(v)
            # require a meaningful trough magnitude as well when marking pothole from asymmetry
            if asymz < 0.30 and abs(T_val) >= float(min_trough_abs):
                pothole = True
        # and a strong negative trough relative to peak is a robust sign of a pothole
        # time ordering: trough then peak within short delta indicates pothole
        try:
            global_T_idx = sidx + T_idx
            global_P_idx = sidx + P_idx
            delta_tp = (global_P_idx - global_T_idx) * local_dt
        except Exception:
            delta_tp = 0.0
        if T_val < 0 and rtp < -abs(float(rtp_pothole_ratio)) and abs(T_val) > float(min_trough_abs) and delta_tp >= 0 and abs(delta_tp) < 0.3 and global_T_idx <= global_P_idx:
            pothole = True
        # Hump: elevated 1.0-2.0s and symmetric OR strong positive peak with symmetry
        if longest_elev >= 1.0 and longest_elev <= 2.0:
            symz = symmetry_score_z(v)
            if symz >= 0.70:
                hump = True
        # hump detection: strong positive peak, peak precedes trough and is symmetric
        if P_val > 0 and P_val >= float(hump_peak_thresh) and abs(P_val) > float(min_peak_abs) and symmetry_score_z(v_sub) >= 0.6 and (global_P_idx < global_T_idx) and abs(delta_tp) < 0.6:
            hump = True
        # Force hump if raw acceleration magnitude peaks above hump_mag_thresh (e.g., 20 m/s^2)
        try:
            if peak_raw_mag >= float(hump_mag_thresh):
                hump = True
        except Exception:
            pass
        # Rumble: FFT check on magnitude
        local_fs = 1.0 / local_dt if local_dt>0 else 100.0
        if detect_rumble_fft(mag, sample_rate=local_fs, fft_cv_thresh=fft_cv_thresh):
            # apply FFT CV threshold
            # Note: detect_rumble_fft currently returns boolean based on hardcoded cv<0.25
            # We keep that behavior for now; caller may tune detect_rumble_fft if needed
            rumble = True

        # severity (tunable thresholds)
        try:
            mn = float(minor_thresh)
            bd = float(bad_thresh)
        except Exception:
            mn = 0.25
            bd = 0.5
        # ensure ordering
        if not (mn < bd):
            mn = 0.25; bd = 0.5
        if vibration < mn:
            severity = 'GOOD'
        elif vibration < bd:
            severity = 'MINOR'
        else:
            severity = 'BAD'

        label = to_label(severity, pothole, hump, rumble, window_valid)
        color = COLOR_MAP.get(label, COLOR_MAP['UNKNOWN'])

        # Optional: derive a coarse road roughness grade using simple spectral bands
        # Bands: low (0.5-5 Hz), mid (5-12 Hz), high (12-20 Hz)
        try:
            Nfft = int(2**np.ceil(np.log2(max(16, len(mag)))))
            xw = (mag - np.mean(mag)) * (np.hanning(len(mag)) if len(mag)>1 else 1.0)
            if len(xw) < Nfft:
                xw = np.pad(xw, (0, Nfft-len(xw)))
            spec = np.abs(np.fft.rfft(xw))
            freqs = np.fft.rfftfreq(len(xw), d=1.0/local_fs if local_fs>0 else 0.01)
            def band_energy(f0,f1):
                m = (freqs>=f0) & (freqs<f1)
                return float(np.sum(spec[m]**2)) if np.any(m) else 0.0
            e_low = band_energy(0.5,5.0)
            e_mid = band_energy(5.0,12.0)
            e_high= band_energy(12.0,20.0)
            e_tot = e_low+e_mid+e_high
            if e_tot>0:
                nl, nm, nh = e_low/e_tot, e_mid/e_tot, e_high/e_tot
            else:
                nl, nm, nh = 0.0,0.0,0.0
            # Heuristic mapping: high mid-band content and higher vibration => rough
            if vibration < max(0.20, minor_thresh*0.8):
                road_grade = 'SMOOTH'
            elif (nm > 0.45 and vibration >= bad_thresh*0.8) or vibration >= bad_thresh*1.2:
                road_grade = 'ROUGH'
            else:
                road_grade = 'MODERATE'
        except Exception:
            road_grade = 'UNKNOWN'

        # mean lat/lon for window
        mean_lat = float(np.nanmean(win['latitude'].astype(float).values)) if 'latitude' in win.columns else float('nan')
        mean_lon = float(np.nanmean(win['longitude'].astype(float).values)) if 'longitude' in win.columns else float('nan')

        # pick session id from data if available
        session_id = ''
        if 'session_id' in df.columns:
            try:
                session_id = str(df['session_id'].iloc[0])
            except Exception:
                session_id = ''

        rows_out.append({
            'session': session_id,
            # keep both legacy keys and new keys so frontend and CSV writers continue to work
            'win_idx': int(win_idx),
            'window_id': int(win_idx),
            'window_start_ms': win_start_ms,
            'timestamp': win_start_ms,
            'latitude': mean_lat,
            'longitude': mean_lon,
            'avg_speed_kph': avg_speed,
            'speed': avg_speed,
            'vibration_intensity': vibration,
            'anomaly_score': anomaly,
            'label': label,
            'road_grade': road_grade,
            'color_hex': color,
            'samples': samples,
            # debugging features
            'peak_z': P_val,
            'trough_z': T_val,
            'rtp': rtp,
            'skew_z': skew_z,
            'kurtosis_z': kurt_z,
            'jerk_max': jerk_max,
            'peak_mag': peak_raw_mag,
        })

    # prepare events list
    events_out = rows_out
    return events_out, df


def compute_gyro_scale_from_df(df: pd.DataFrame, min_samples: int = 70, min_speed_kph: float = 5.0):
    """Estimate a gyro_scale by comparing median accel RMS to median gyro RMS across windows.

    Returns recommended gyro_scale (float). If insufficient data, returns default 0.1.
    """
    # prepare copy and time_s
    d = df.copy()
    if 'timestamp' not in d.columns:
        raise ValueError('input dataframe must have timestamp column')
    d['timestamp'] = pd.to_numeric(d['timestamp'], errors='coerce')
    d = d.dropna(subset=['timestamp']).reset_index(drop=True)
    tms = d['timestamp'].astype(float).values
    t0 = tms[0]
    d['time_s'] = (tms - t0) / 1000.0
    d['win_idx'] = (d['time_s'] // 1.0).astype(int)

    accel_rms_vals = []
    gyro_rms_vals = []

    grouped = d.groupby('win_idx')
    for win_idx, win in grouped:
        samples = len(win)
        if samples < int(min_samples):
            continue
        # avg speed (if available)
        if 'speed' in win.columns:
            sp = win['speed'].astype(float).values if samples > 0 else np.array([np.nan])
            if np.isnan(sp).all():
                avg_speed = float('nan')
            else:
                avg_speed = float(np.nanmean(sp))
            if np.isfinite(avg_speed) and avg_speed > 0 and avg_speed < float(min_speed_kph):
                continue

        # accel
        ax = win['accel_x'].astype(float).values if 'accel_x' in win.columns else None
        ay = win['accel_y'].astype(float).values if 'accel_y' in win.columns else None
        az = win['accel_z'].astype(float).values if 'accel_z' in win.columns else None
        if ax is None or ay is None or az is None:
            continue
        # local dt
        if samples >= 2:
            local_dts = np.diff(win['time_s'].values.astype(float))
            local_dts = local_dts[local_dts > 0]
            local_dt = float(np.median(local_dts)) if local_dts.size else 0.01
        else:
            local_dt = 0.01

        xf = apply_highpass(ax, dt=local_dt, fc=1.0)
        yf = apply_highpass(ay, dt=local_dt, fc=1.0)
        zf = apply_highpass(az, dt=local_dt, fc=1.0)
        a_rms = compute_vibration_rms(xf, yf, zf)

        # gyro
        if 'gyro_x' in win.columns and 'gyro_y' in win.columns and 'gyro_z' in win.columns:
            gx = win['gyro_x'].astype(float).values
            gy = win['gyro_y'].astype(float).values
            gz = win['gyro_z'].astype(float).values
            gxf = apply_highpass(gx, dt=local_dt, fc=0.5)
            gyf = apply_highpass(gy, dt=local_dt, fc=0.5)
            gzf = apply_highpass(gz, dt=local_dt, fc=0.5)
            g_rms = compute_vibration_rms(gxf, gyf, gzf)
        else:
            g_rms = 0.0

        if a_rms > 0 and g_rms > 0:
            accel_rms_vals.append(a_rms)
            gyro_rms_vals.append(g_rms)

    if not accel_rms_vals or not gyro_rms_vals:
        return 0.1

    med_accel = float(np.median(np.array(accel_rms_vals)))
    med_gyro = float(np.median(np.array(gyro_rms_vals)))
    if med_gyro <= 0:
        return 0.1
    return float(med_accel / med_gyro)


