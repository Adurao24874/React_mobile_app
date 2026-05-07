import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT o.department_name, COUNT(w.id) as pending_reports
      FROM office_details o
      LEFT JOIN work_orders w ON o.id = w.office_id AND w.status != 'Resolved'
      GROUP BY o.department_name;
    `;
    
    const result = await pool.query(query);
    
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch data" }, { status: 500 });
  }
}