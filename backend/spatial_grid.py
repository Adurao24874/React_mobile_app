import math

# ~1 meter at the equator; override per use-case when needed.
CELL_SIZE = 0.00001


def map_to_region(lat, lng, cell_size=CELL_SIZE):
    return {
        "x": math.floor(float(lat) / cell_size),
        "y": math.floor(float(lng) / cell_size),
    }


def get_region_key(x, y, separator=","):
    return f"{x}{separator}{y}"
