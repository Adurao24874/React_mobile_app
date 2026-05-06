"""
Statistics utilities: RMS and deviation calculations
for sensor data analysis and region-based metrics
"""

import math


def compute_deviation(points):
    """
    Compute variance of latitude values in a list of GPS points
    
    Measures how spread out the GPS coordinates are within a region.
    High deviation = scattered path, Low deviation = concentrated path
    
    Args:
        points: list of dicts with 'lat' and 'lng' keys
                e.g., [{'lat': 15.4909, 'lng': 73.8278}, ...]
    
    Returns:
        float: variance of latitude values
    """
    if not points or len(points) < 2:
        return 0.0
    
    # Extract latitude values
    lats = [p.get('lat', 0) for p in points]
    
    # Compute mean
    mean = sum(lats) / len(lats)
    
    # Compute variance
    variance = sum((lat - mean) ** 2 for lat in lats) / len(lats)
    
    return variance


def compute_lng_deviation(points):
    """
    Compute variance of longitude values in a list of GPS points
    
    Args:
        points: list of dicts with 'lat' and 'lng' keys
    
    Returns:
        float: variance of longitude values
    """
    if not points or len(points) < 2:
        return 0.0
    
    # Extract longitude values
    lngs = [p.get('lng', 0) for p in points]
    
    # Compute mean
    mean = sum(lngs) / len(lngs)
    
    # Compute variance
    variance = sum((lng - mean) ** 2 for lng in lngs) / len(lngs)
    
    return variance


def compute_rms(accel_array):
    """
    Compute Root Mean Square of acceleration values
    
    RMS gives a single metric representing overall vibration magnitude.
    Used to quantify road roughness/pothole severity.
    
    Args:
        accel_array: list of float values (accelerations)
                    e.g., [0.5, 1.2, 0.8, 2.1, ...]
    
    Returns:
        float: RMS value (sqrt of mean of squared values)
    """
    if not accel_array or len(accel_array) == 0:
        return 0.0
    
    # Sum of squares
    sum_of_squares = sum(a * a for a in accel_array)
    
    # Mean of squares
    mean_of_squares = sum_of_squares / len(accel_array)
    
    # Root mean square
    rms = math.sqrt(mean_of_squares)
    
    return rms


def compute_accel_rms_3d(readings):
    """
    Compute 3D RMS from acceleration readings (x, y, z components)
    
    This computes the magnitude of acceleration at each time step,
    then returns the RMS of those magnitudes.
    
    Args:
        readings: list of dicts with 'accelX', 'accelY', 'accelZ' keys
                 e.g., [{'accelX': 0.1, 'accelY': 0.2, 'accelZ': 1.5}, ...]
    
    Returns:
        float: 3D RMS value
    """
    if not readings or len(readings) == 0:
        return 0.0
    
    # Compute magnitude at each timestep
    magnitudes = []
    for r in readings:
        x = r.get('accelX', 0)
        y = r.get('accelY', 0)
        z = r.get('accelZ', 0)
        magnitude = math.sqrt(x**2 + y**2 + z**2)
        magnitudes.append(magnitude)
    
    # Compute RMS of magnitudes
    return compute_rms(magnitudes)


def compute_peak_acceleration(accel_array):
    """
    Find the maximum acceleration value in array
    
    Useful for detecting sharp spikes (potholes, bumps)
    
    Args:
        accel_array: list of float values
    
    Returns:
        float: peak (max) value
    """
    if not accel_array or len(accel_array) == 0:
        return 0.0
    
    return max(abs(a) for a in accel_array)


def compute_average_acceleration(accel_array):
    """
    Compute simple average (mean) of acceleration values
    
    Args:
        accel_array: list of float values
    
    Returns:
        float: mean value
    """
    if not accel_array or len(accel_array) == 0:
        return 0.0
    
    return sum(accel_array) / len(accel_array)
