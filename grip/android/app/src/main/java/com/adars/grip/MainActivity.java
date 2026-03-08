package com.adars.grip;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Request Activity Recognition and Body Sensors permissions for data collection
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            boolean needsActivity = ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED;
            boolean needsSensors = ContextCompat.checkSelfPermission(this, Manifest.permission.BODY_SENSORS) != PackageManager.PERMISSION_GRANTED;
            
            if (needsActivity || needsSensors) {
                ActivityCompat.requestPermissions(this,
                    new String[]{
                        Manifest.permission.ACTIVITY_RECOGNITION, 
                        Manifest.permission.BODY_SENSORS
                    }, 1);
            }
        }
    }
}
