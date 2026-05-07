import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT 
        f.id as worker_id,
        f.worker_name,
        f.specialty,
        f.phone_number,
        f.is_available,
        d.department_name,
        d.taluka_name,
        -- Count how many unresolved tasks this specific worker has right now
        COUNT(w.id) FILTER (WHERE w.status != 'Resolved') as active_tasks
      FROM field_workers f
      -- 1. Updated to the new 'departments' table and 'department_id' foreign key
      JOIN departments d ON f.department_id = d.id
      LEFT JOIN work_orders w ON w.worker_id = f.id
      -- 2. Strictly filter out the Village Panchayat workers!
      WHERE d.department_type = 'PWD_DIVISION'
      GROUP BY f.id, d.department_name, d.taluka_name
      ORDER BY d.taluka_name ASC, f.worker_name ASC;
    `;
    
    const result = await pool.query(query);
    return NextResponse.json({ success: true, workers: result.rows });
  } catch (error) {
    console.error("Workers API Error:", error);
    return NextResponse.json({ success: false, error: "Database fetch failed" }, { status: 500 });
  }
}