package com.adars.grip;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.Manifest;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.net.Uri;
import android.content.SharedPreferences;

import org.json.JSONArray;

@CapacitorPlugin(name = "GripSensor", permissions = {
        @Permission(alias = "sensors", strings = { Manifest.permission.BODY_SENSORS }),
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE })
})
public class GripSensorPlugin extends Plugin {
    @Override
    public void load() {
        super.load();
        Log.d("GripSensor", "GripSensor plugin successfully loaded!");
    }

    private GripSensorService sensorService;
    private boolean isBound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder service) {
            GripSensorService.LocalBinder binder = (GripSensorService.LocalBinder) service;
            sensorService = binder.getService();
            isBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            isBound = false;
        }
    };

    @PluginMethod
    public void startRecording(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, GripSensorService.class);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }

        context.bindService(intent, connection, Context.BIND_AUTO_CREATE);

        JSObject ret = new JSObject();
        ret.put("status", "started");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (isBound) {
            getContext().unbindService(connection);
            isBound = false;
        }

        Intent intent = new Intent(getContext(), GripSensorService.class);
        getContext().stopService(intent);

        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }

    @PluginMethod
    public void getReadings(PluginCall call) {
        if (sensorService != null) {
            JSONArray readings = sensorService.getAndClearReadings();
            JSObject ret = new JSObject();
            ret.put("readings", readings);
            call.resolve(ret);
        } else {
            call.reject("Service not bound");
        }
    }

    @PluginMethod
    public void getPromptStates(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("GripPrefs", Context.MODE_PRIVATE);
        JSObject ret = new JSObject();
        ret.put("permissionPrompted", prefs.getBoolean("permission_prompted", false));
        ret.put("batteryPrompted", prefs.getBoolean("battery_prompted", false));
        call.resolve(ret);
    }

    @PluginMethod
    public void markPermissionPrompted(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("GripPrefs", Context.MODE_PRIVATE);
        prefs.edit().putBoolean("permission_prompted", true).apply();
        call.resolve();
    }

    @PluginMethod
    public void markBatteryPrompted(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("GripPrefs", Context.MODE_PRIVATE);
        prefs.edit().putBoolean("battery_prompted", true).apply();
        call.resolve();
    }

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean isIgnored = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            isIgnored = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("isIgnored", isIgnored);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBatteryOptimizationBypass(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("GripPrefs", Context.MODE_PRIVATE);
        prefs.edit().putBoolean("battery_prompted", true).apply();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent();
            intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getContext().startActivity(intent);
        }
        call.resolve();
    }
}
