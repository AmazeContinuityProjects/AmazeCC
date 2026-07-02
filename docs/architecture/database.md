# Database Design

## Overview

PostgreSQL database hosted on Supabase with Row Level Security (RLS) policies.

## Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_no VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  campus VARCHAR(50),
  school VARCHAR(100),
  program VARCHAR(100),
  batch VARCHAR(20),
  section VARCHAR(10),
  token_hash VARCHAR(512), -- HMAC-SHA256 of token
  token_expires_at TIMESTAMPTZ,
  refresh_token_hash VARCHAR(512),
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_reg_no ON users(reg_no);
CREATE INDEX idx_users_token_hash ON users(token_hash);
```

#### sessions
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vtop_cookies JSONB NOT NULL, -- Encrypted cookie jar
  vtop_session_id VARCHAR(100),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

#### cached_data
```sql
CREATE TABLE cached_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint VARCHAR(100) NOT NULL,
  params JSONB DEFAULT '{}',
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint, params)
);

CREATE INDEX idx_cached_data_user_endpoint ON cached_data(user_id, endpoint);
CREATE INDEX idx_cached_data_expires_at ON cached_data(expires_at);
```

#### preferences
```sql
CREATE TABLE preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'system', -- light, dark, midnight, system
  accent_color VARCHAR(7) DEFAULT '#00d4aa',
  font_size VARCHAR(20) DEFAULT 'medium',
  reduced_motion BOOLEAN DEFAULT false,
  notifications_enabled BOOLEAN DEFAULT true,
  notification_types JSONB DEFAULT '{"attendance": true, "marks": true, "events": true}',
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Academic Tables

#### attendance_history
```sql
CREATE TABLE attendance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_code VARCHAR(20) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  attended INTEGER NOT NULL,
  total INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  semester VARCHAR(20)
);

CREATE INDEX idx_attendance_user_semester ON attendance_history(user_id, semester);
CREATE INDEX idx_attendance_recorded_at ON attendance_history(recorded_at);
```

#### marks_history
```sql
CREATE TABLE marks_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_code VARCHAR(20) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  assessment_type VARCHAR(50) NOT NULL, -- CAT1, CAT2, FAT, Quiz, Assignment
  marks_obtained DECIMAL(5,2),
  max_marks DECIMAL(5,2),
  weightage DECIMAL(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  semester VARCHAR(20)
);

CREATE INDEX idx_marks_user_semester ON marks_history(user_id, semester);
```

#### grades_history
```sql
CREATE TABLE grades_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  semester VARCHAR(20) NOT NULL,
  subject_code VARCHAR(20) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  credits INTEGER NOT NULL,
  grade VARCHAR(2) NOT NULL, -- S, A, B, C, D, E, F
  grade_points DECIMAL(3,2) NOT NULL,
  sgpa DECIMAL(3,2),
  cgpa DECIMAL(3,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grades_user_semester ON grades_history(user_id, semester);
```

### Hostel Tables

#### hostel_info
```sql
CREATE TABLE hostel_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hostel_name VARCHAR(100),
  block VARCHAR(20),
  floor INTEGER,
  room_number VARCHAR(20),
  room_type VARCHAR(20), -- Single, Double, Triple
  mess_type VARCHAR(20), -- Veg, Non-Veg, Both
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### mess_menu
```sql
CREATE TABLE mess_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL, -- Breakfast, Lunch, Snacks, Dinner
  items TEXT[] NOT NULL,
  campus VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, meal_type, campus)
);

CREATE INDEX idx_mess_menu_date_campus ON mess_menu(date, campus);
```

### Event Tables

#### events
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  club_name VARCHAR(100),
  venue VARCHAR(255),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  registration_url VARCHAR(500),
  image_url VARCHAR(500),
  is_featured BOOLEAN DEFAULT false,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_club ON events(club_name);
```

#### user_events
```sql
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id VARCHAR(50) REFERENCES events(event_id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  attended BOOLEAN DEFAULT false,
  UNIQUE(user_id, event_id)
);
```

### Transport Tables

#### bus_routes
```sql
CREATE TABLE bus_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_number VARCHAR(20) NOT NULL,
  route_name VARCHAR(100) NOT NULL,
  campus VARCHAR(50) NOT NULL,
  stops JSONB NOT NULL, -- Array of {name, time, lat, lng}
  is_ac BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Admin Tables

#### fresher_resources
```sql
CREATE TABLE fresher_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- Academic, Hostel, Transport, General
  content JSONB, -- Rich content (links, images, docs)
  is_published BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

## Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_data ENABLE ROW LEVEL SECURITY;
-- ... etc

-- Policies
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own preferences" ON preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
```

## Functions & Triggers

### Updated At Trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Repeat for other tables
```

### Cache Cleanup Function
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cached_data WHERE expires_at < NOW();
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Schedule via pg_cron
SELECT cron.schedule('cleanup-cache', '0 * * * *', 'SELECT cleanup_expired_cache();');
```

## Migrations

Located in `supabase_setup.sql` and `migrate.sql` at project root.

Run migrations:
```bash
# Via Supabase CLI
supabase db push

# Or directly
psql $DATABASE_URL -f supabase_setup.sql
```

## Backup & Recovery

- **Automated**: Supabase daily backups (7-day retention)
- **Point-in-time Recovery**: Available via Supabase dashboard
- **Manual Export**: `pg_dump` for local backups

## Related Documentation

- [Backend Architecture](./backend.md)
- [Authentication System](./authentication.md)
- [Deployment Guide](../../deployment/database.md)