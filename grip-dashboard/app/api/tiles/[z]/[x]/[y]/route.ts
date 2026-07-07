import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Notice we changed the type of params to be a Promise
export async function GET(
  request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> } 
) {
  // 🔥 THE FIX: Await the params before trying to read them!
  const resolvedParams = await params;

  // Now we can safely parse the Mapbox tile coordinates
  const z = parseInt(resolvedParams.z);
  const x = parseInt(resolvedParams.x);
  const y = parseInt(resolvedParams.y);

  // The PostGIS Magic: This converts your lat/lng into web mercator tiles
  const query = `
    WITH bounds AS (
      SELECT ST_TileEnvelope($1, $2, $3) AS geom
    ),
    mvtgeom AS (
      SELECT
        ST_AsMVTGeom(
          ST_Transform(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), 3857),
          bounds.geom
        ) AS geom,
        label,
        segment_id,
        last_updated
      FROM road_segments, bounds
      -- Only fetch points that physically fit inside this exact tile
      WHERE ST_Intersects(
        ST_Transform(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), 3857),
        bounds.geom
      )
    )
    -- Compress into a binary Protocol Buffer
    SELECT ST_AsMVT(mvtgeom, 'vibrations') AS tile FROM mvtgeom;
  `;

  try {
    const result = await pool.query(query, [z, x, y]);
    const tile = result.rows[0]?.tile;

    // If the tile is empty (e.g., the ocean), return a 204 No Content
    if (!tile || tile.length === 0) {
      return new Response(null, { status: 204 });
    }

    // Return the binary data directly to Leaflet
    return new Response(tile, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.mapbox-vector-tile',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600', // Cache tiles in the browser for an hour
      },
    });
  } catch (error) {
    console.error("Vector Tile Error:", error);
    return NextResponse.json({ error: "Failed to generate tile" }, { status: 500 });
  }
}