package com.adars.grip;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Binder;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.HandlerThread;
import android.os.Handler;
import android.content.pm.ServiceInfo;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class GripSensorService extends Service implements SensorEventListener, LocationListener {
    private static final String TAG = "GripSensorService";
    private static final String CHANNEL_ID = "GripSensorChannel";

    private SensorManager sensorManager;
    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;

    private List<JSONObject> readings = new ArrayList<>();
    private double currentLat = 0;
    private double currentLng = 0;
    private long lastSavedTime = 0;
    private HandlerThread sensorThread;
    private Handler sensorHandler;
    private final Handler heartbeatHandler = new Handler();

    private final IBinder binder = new LocalBinder();

    public class LocalBinder extends Binder {
        GripSensorService getService() {
            return GripSensorService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Grip:SensorWakeLock");

        sensorThread = new HandlerThread("GripSensorThread");
        sensorThread.start();
        sensorHandler = new Handler(sensorThread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("GRIP Recording Active")
                .setContentText("Collecting road telemetry in the background...")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION | ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(1, notification);
        }

        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire();
        }

        startInertialSensors();
        startGps();

        return START_STICKY;
    }

    private void startInertialSensors() {
        Sensor accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        Sensor gyro = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);

        // Use SENSOR_DELAY_FASTEST and 0 latency to prevent batching/suspension
        sensorManager.registerListener(this, accel, SensorManager.SENSOR_DELAY_FASTEST, 0, sensorHandler);
        sensorManager.registerListener(this, gyro, SensorManager.SENSOR_DELAY_FASTEST, 0, sensorHandler);

        startHeartbeat();
    }

    private void startHeartbeat() {
        heartbeatHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (sensorManager != null) {
                    Log.d(TAG, "Heartbeat: Service active, collected " + readings.size() + " samples");
                }
                heartbeatHandler.postDelayed(this, 10000);
            }
        }, 10000);
    }

    private void startGps() {
        try {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, this);
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission missing", e);
        }
    }

    private float lastAx = 0, lastAy = 0, lastAz = 0;
    private float lastGx = 0, lastGy = 0, lastGz = 0;

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            lastAx = event.values[0];
            lastAy = event.values[1];
            lastAz = event.values[2];
        } else if (event.sensor.getType() == Sensor.TYPE_GYROSCOPE) {
            lastGx = event.values[0];
            lastGy = event.values[1];
            lastGz = event.values[2];
        }

        long currentTime = System.currentTimeMillis();
        // Target 70Hz (approx 14ms interval)
        if (currentTime - lastSavedTime < 14)
            return;
        lastSavedTime = currentTime;

        try {
            JSONObject reading = new JSONObject();
            reading.put("accelX", lastAx);
            reading.put("accelY", lastAy);
            reading.put("accelZ", lastAz);
            reading.put("gyroX", lastGx);
            reading.put("gyroY", lastGy);
            reading.put("gyroZ", lastGz);
            reading.put("lat", currentLat);
            reading.put("lng", currentLng);
            reading.put("timestamp", currentTime);

            readings.add(reading);

            // Update notification every ~5 seconds with sample count to help user verify
            // screen-off activity
            if (readings.size() % 350 == 0) {
                updateNotification("Collected " + readings.size() + " samples...");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in sensor changed", e);
        }
    }

    private void updateNotification(String text) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("GRIP Recording Active")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .build();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(1, notification);
    }

    // This service logic will be refined to match the exact JSON structure App.tsx
    // expects.
    // We will share a common temporary list and then return it via the binder.

    public JSONArray getAndClearReadings() {
        JSONArray arr = new JSONArray(readings);
        readings.clear();
        return arr;
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    @Override
    public void onLocationChanged(Location location) {
        currentLat = location.getLatitude();
        currentLng = location.getLongitude();
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
    }

    @Override
    public void onProviderEnabled(String provider) {
    }

    @Override
    public void onProviderDisabled(String provider) {
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        sensorManager.unregisterListener(this);
        locationManager.removeUpdates(this);
        heartbeatHandler.removeCallbacksAndMessages(null);
        if (sensorThread != null) {
            sensorThread.quitSafely();
        }
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Grip Sensor Service Channel",
                    NotificationManager.IMPORTANCE_HIGH);
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }
}
