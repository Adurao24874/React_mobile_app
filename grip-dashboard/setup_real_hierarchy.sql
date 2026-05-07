BEGIN;

-- 1. Wipe out the old dummy data (Cascade deletes connected work orders & old workers)
TRUNCATE TABLE office_details, field_workers, work_orders, citizen_reports CASCADE;

-- 2. Upgrade the Office table to handle State and District levels
ALTER TABLE office_details 
ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'Goa',
ADD COLUMN IF NOT EXISTS district VARCHAR(50);

-- 3. Insert the 12 REAL Goa Taluka Offices (State -> District -> Sub-District)
INSERT INTO office_details (state, district, taluka_name, department_name, officer_in_charge, contact_email) VALUES
-- North Goa District
('Goa', 'North Goa', 'Pernem', 'PWD Division Pernem', 'Executive Engineer (Pernem)', 'admin.pernem@pwd.goa.in'),
('Goa', 'North Goa', 'Bardez', 'PWD Division Bardez', 'Executive Engineer (Bardez)', 'admin.bardez@pwd.goa.in'),
('Goa', 'North Goa', 'Tiswadi', 'PWD Division Tiswadi', 'Executive Engineer (Tiswadi)', 'admin.tiswadi@pwd.goa.in'),
('Goa', 'North Goa', 'Bicholim', 'PWD Division Bicholim', 'Executive Engineer (Bicholim)', 'admin.bicholim@pwd.goa.in'),
('Goa', 'North Goa', 'Sattari', 'PWD Division Sattari', 'Executive Engineer (Sattari)', 'admin.sattari@pwd.goa.in'),

-- South Goa District
('Goa', 'South Goa', 'Ponda', 'PWD Division Ponda', 'Executive Engineer (Ponda)', 'admin.ponda@pwd.goa.in'),
('Goa', 'South Goa', 'Salcete', 'PWD Division Salcete', 'Executive Engineer (Salcete)', 'admin.salcete@pwd.goa.in'),
('Goa', 'South Goa', 'Mormugao', 'PWD Division Mormugao', 'Executive Engineer (Mormugao)', 'admin.mormugao@pwd.goa.in'),
('Goa', 'South Goa', 'Quepem', 'PWD Division Quepem', 'Executive Engineer (Quepem)', 'admin.quepem@pwd.goa.in'),
('Goa', 'South Goa', 'Sanguem', 'PWD Division Sanguem', 'Executive Engineer (Sanguem)', 'admin.sanguem@pwd.goa.in'),
('Goa', 'South Goa', 'Canacona', 'PWD Division Canacona', 'Executive Engineer (Canacona)', 'admin.canacona@pwd.goa.in'),
('Goa', 'South Goa', 'Dharbandora', 'PWD Division Dharbandora', 'Executive Engineer (Dharbandora)', 'admin.dharbandora@pwd.goa.in');

-- 4. Hire 3 Realistic Field Workers for EACH of the 12 Offices (36 Total Workers)
INSERT INTO field_workers (office_id, worker_name, phone_number, specialty)
SELECT 
    id, 
    -- Generates realistic Goan sounding names randomly for the simulation
    (ARRAY['Sanjay', 'Rajesh', 'Amit', 'Prakash', 'Sunil', 'Ramesh', 'Vijay', 'Anil', 'Nilesh', 'Santosh'])[floor(random() * 10 + 1)] || ' ' || 
    (ARRAY['Naik', 'Dessai', 'Gaonkar', 'Sawant', 'Kadam', 'Prabhu', 'Kamat', 'Tari', 'Fadte', 'Chari'])[floor(random() * 10 + 1)],
    '9822' || lpad(floor(random() * 1000000)::text, 6, '0'), -- Generates realistic 10-digit Goa mobile numbers
    (ARRAY['Road Repair', 'Sanitation & Waste', 'Electrical & Lighting'])[floor(random() * 3 + 1)]
FROM office_details, generate_series(1, 3); -- generate_series(1,3) loops 3 times per office

COMMIT;