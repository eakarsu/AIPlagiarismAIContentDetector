CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_analyses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  analysis_type VARCHAR(100),
  entity_id INTEGER,
  entity_type VARCHAR(50),
  result JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
