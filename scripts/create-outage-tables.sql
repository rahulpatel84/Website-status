-- Create outage reports table for storing user-reported issues
CREATE TABLE IF NOT EXISTS outage_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_slug TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  user_ip TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  latitude REAL,
  longitude REAL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_company_slug ON outage_reports(company_slug);
CREATE INDEX IF NOT EXISTS idx_created_at ON outage_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_issue_type ON outage_reports(issue_type);

-- Create aggregated outage stats table for faster chart queries
CREATE TABLE IF NOT EXISTS outage_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_slug TEXT NOT NULL,
  hour_timestamp DATETIME NOT NULL,
  total_reports INTEGER DEFAULT 0,
  website_reports INTEGER DEFAULT 0,
  services_reports INTEGER DEFAULT 0,
  api_reports INTEGER DEFAULT 0,
  mobile_app_reports INTEGER DEFAULT 0,
  payment_system_reports INTEGER DEFAULT 0,
  login_reports INTEGER DEFAULT 0,
  other_reports INTEGER DEFAULT 0,
  UNIQUE(company_slug, hour_timestamp)
);

-- Create index for stats table
CREATE INDEX IF NOT EXISTS idx_stats_company_hour ON outage_stats(company_slug, hour_timestamp);
