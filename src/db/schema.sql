CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  fcm_token TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 캘린더 원본 이벤트 캐시. AI 분류 결과를 저장해서 같은 이벤트를 반복 분류하지 않도록 함
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  calendar_event_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  is_outdoor BOOLEAN,
  location_name TEXT,
  start_date DATE,
  end_date DATE,
  classified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (device_id, calendar_event_id)
);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  calendar_event_id TEXT NOT NULL,
  title TEXT,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (device_id, calendar_event_id)
);

CREATE TABLE IF NOT EXISTS forecast_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ DEFAULT now(),
  forecast_available BOOLEAN,
  weather_summary JSONB,
  ai_advice TEXT,
  notified BOOLEAN DEFAULT false,
  notified_at TIMESTAMPTZ
);
