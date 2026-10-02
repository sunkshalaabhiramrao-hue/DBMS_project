CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  aadhaar_id VARCHAR(12) UNIQUE,
  phone VARCHAR(15) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS license_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  front_path VARCHAR(255) NOT NULL,
  back_path VARCHAR(255) NOT NULL,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'action_needed',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT license_verification_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorite_vehicles (
  user_id INT NOT NULL,
  vehicle_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, vehicle_id),
  CONSTRAINT favorite_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pickup_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  opening_hours VARCHAR(120),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  UNIQUE KEY pickup_location_name_city (name, city)
);

INSERT IGNORE INTO pickup_locations (name, address, city, phone, opening_hours, latitude, longitude)
VALUES ('KPHB Branch', 'KPHB Phase 5, Kukatpally', 'Hyderabad', '+91 40 4000 1500', '07:00 - 22:00', 17.4849, 78.3996);

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS mileage VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS engine_type VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS availability VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1) NULL;

