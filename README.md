# GRIP Data ML-Enabled App

This repository contains the source code for the GRIP project, which includes a React mobile application (frontend) and an ML-enabled API (backend).

## Project Structure

*   **`grip/` (Frontend):** 
    *   A mobile application built with React, Vite, and Tailwind CSS.
    *   Uses Ionic Capacitor to bridge the web app to native mobile platforms (Android/iOS).
    *   Features geolocation, camera capabilities, and connects to a Supabase backend.
*   **`backend/` (Backend):**
    *   A FastAPI application acting as the Data API.
    *   Integrates YOLO models (`garbage.pt`, `pothole.pt`) for image classification and Roboflow REST APIs.
    *   Handles image uploads (active issues) and sensor telemetry data (passive issues).
    *   Stores data and predictions in a Supabase database.

## Data & ML Flow Architecture

The GRIP system uses a hybrid processing model where data is collected on the edge and processed in the cloud:

### 1. Passive Sensor Telemetry (Segment-Based Mapping)
*   **Collection**: The mobile app (`grip/src/App.tsx`) records accelerometer and gyroscope data at **50Hz**. 
*   **Auto-Upload**: Data now syncs to the server every **2 minutes** (120s pulse) while recording, ensuring zero data loss and low memory overhead on long trips.
*   **Spatial Binning**: Instead of raw points, the system quantizes the map into **3-meter grid segments** (`road_segments`). 
*   **Physics Engine**: The `backend/telemetry.py` extracts **Vertical RMS** (roughness) and **Lateral Variance** (swerving/shaking) for each segment.
*   **Advanced Avoidance Detection**: Using Step-by-Step Spatial Intelligence:
    *   **Coverage Analysis**: Detects "holes" in the map where riders consistently avoid a segment.
    *   **Neighbor Profiling**: Fetches the 6 nearest neighbors to confirm if swerving (lateral variance) occurred around the skip-zone.
    *   **Labeling**: Automatically classifies segments as `smooth`, `rough`, `pothole`, or `avoided_obstacle` (Purple Zones).
*   **Weighted Averaging**: Road quality is updated using a running weighted average across multiple users, ensuring the map becomes more accurate over time.

### 2. Active Image Reports (Debris Detection)
*   **Collection**: Users capture images of road issues (garbage, deep potholes) via the **Camera API**.
*   **Transport**: Images are uploaded to the `reports` bucket in **Supabase Storage**.
*   **Processing**: `backend/worker.py` detects pending reports and runs local **YOLO AI models** (`garbage.pt`, `pothole.pt`).
*   **Classification**: High-confidence detections are labeled (e.g., "Plastic Waste", "Deep Pothole") and stored in the `reports` table.

## Tasks Performed During Initialization

1.  **Repository Setup:** Initialized a local Git repository for the project.
2.  **Ignored Unnecessary Files:** Created a `.gitignore` file to exclude `node_modules/`, `__pycache__/`, virtual environments, built Android/iOS folders, and logs.
3.  **First Commit:** Staged and committed all frontend and backend source code files locally.
4.  **GitHub Push:** Added the remote origin (`https://github.com/Adurao24874/React_mobile_app.git`), set the default branch to `main`, and securely pushed the initial codebase to GitHub.
5.  **Documentation:** Analyzed the project structure and documented the components in this `README.md`.
