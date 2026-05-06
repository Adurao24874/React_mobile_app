"""
Region Analysis: Compute density ratios and find nearby regions
to detect avoided roads and traffic patterns
"""

from statistics import compute_rms, compute_deviation, compute_peak_acceleration


def get_nearby_regions(x, y, region_map):
    """
    Get all 8 neighboring regions around (x, y)
    
    Args:
        x: grid x coordinate
        y: grid y coordinate
        region_map: dict of all regions {key: {count, accel, points}}
    
    Returns:
        list of neighboring region data
    """
    neighbors = []
    
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            if dx == 0 and dy == 0:
                continue
            
            key = f"{x + dx},{y + dy}"
            if key in region_map:
                neighbors.append(region_map[key])
    
    return neighbors


def compute_density_ratio(region, neighbors):
    """
    Compare this region's visit count to average of neighbors
    
    High ratio (> 1.5) = This region is popular
    Low ratio (< 0.5) = This region is avoided
    
    Args:
        region: dict with {count, accel, points}
        neighbors: list of neighbor regions
    
    Returns:
        float: density_ratio (region.count / neighbors_avg)
    """
    if not neighbors or len(neighbors) == 0:
        return 1.0
    
    total_visits = sum(n.get('count', 0) for n in neighbors)
    avg_visits = total_visits / len(neighbors)
    
    if avg_visits == 0:
        return 1.0
    
    return region.get('count', 0) / avg_visits


def find_avoided_regions(region_map, avoidance_threshold=0.5):
    """
    Find regions that are actively avoided (low density ratio)
    
    Also computes RMS vibration and GPS deviation for each region
    
    Args:
        region_map: dict of all regions
        avoidance_threshold: ratio below which region is considered avoided
    
    Returns:
        list of {key, region, density_ratio, neighbors_avg, rms, deviation}
    """
    avoided = []
    
    for key, region in region_map.items():
        x, y = map(int, key.split(','))
        neighbors = get_nearby_regions(x, y, region_map)
        
        if not neighbors:
            continue
        
        ratio = compute_density_ratio(region, neighbors)
        
        if ratio < avoidance_threshold:
            neighbors_avg = sum(n.get('count', 0) for n in neighbors) / len(neighbors)
            
            # 📊 COMPUTE VIBRATION RMS
            accel_values = region.get('accel', [])
            rms = compute_rms(accel_values) if accel_values else 0.0
            
            # 📊 COMPUTE GPS DEVIATION
            points = region.get('points', [])
            points_dict = [{'lat': p[0], 'lng': p[1]} for p in points] if points else []
            deviation = compute_deviation(points_dict)
            
            avoided.append({
                'key': key,
                'region': region,
                'density_ratio': ratio,
                'neighbors_avg': neighbors_avg,
                'this_count': region.get('count', 0),
                'rms': rms,
                'deviation': deviation,
                'peak_accel': max(accel_values) if accel_values else 0.0
            })
    
    return sorted(avoided, key=lambda x: x['density_ratio'])


def find_hotspot_regions(region_map, hotspot_threshold=1.5):
    """
    Find regions that are popular/high-traffic (high density ratio)
    
    Also computes RMS vibration and GPS deviation for each region
    
    Args:
        region_map: dict of all regions
        hotspot_threshold: ratio above which region is considered hotspot
    
    Returns:
        list of {key, region, density_ratio, neighbors_avg, rms, deviation}
    """
    hotspots = []
    
    for key, region in region_map.items():
        x, y = map(int, key.split(','))
        neighbors = get_nearby_regions(x, y, region_map)
        
        if not neighbors:
            continue
        
        ratio = compute_density_ratio(region, neighbors)
        
        if ratio > hotspot_threshold:
            neighbors_avg = sum(n.get('count', 0) for n in neighbors) / len(neighbors)
            
            # 📊 COMPUTE VIBRATION RMS
            accel_values = region.get('accel', [])
            rms = compute_rms(accel_values) if accel_values else 0.0
            
            # 📊 COMPUTE GPS DEVIATION
            points = region.get('points', [])
            points_dict = [{'lat': p[0], 'lng': p[1]} for p in points] if points else []
            deviation = compute_deviation(points_dict)
            
            hotspots.append({
                'key': key,
                'region': region,
                'density_ratio': ratio,
                'neighbors_avg': neighbors_avg,
                'this_count': region.get('count', 0),
                'rms': rms,
                'deviation': deviation,
                'peak_accel': max(accel_values) if accel_values else 0.0
            })
    
    return sorted(hotspots, key=lambda x: x['density_ratio'], reverse=True)
