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

## Tasks Performed During Initialization

1.  **Repository Setup:** Initialized a local Git repository for the project.
2.  **Ignored Unnecessary Files:** Created a `.gitignore` file to exclude `node_modules/`, `__pycache__/`, virtual environments, built Android/iOS folders, and logs.
3.  **First Commit:** Staged and committed all frontend and backend source code files locally.
4.  **GitHub Push:** Added the remote origin (`https://github.com/Adurao24874/React_mobile_app.git`), set the default branch to `main`, and securely pushed the initial codebase to GitHub.
5.  **Documentation:** Analyzed the project structure and documented the components in this `README.md`.
