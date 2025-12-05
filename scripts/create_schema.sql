-- PostgreSQL Schema für Gout Diary Service
-- Führe dieses Skript aus: psql -U postgres -d gout_diary -f scripts/create_schema.sql

-- Erstelle Schema
CREATE SCHEMA IF NOT EXISTS gout_diary;

-- Setze Standard-Schema
SET search_path TO gout_diary, public;

-- Users Tabelle
CREATE TABLE IF NOT EXISTS users (
    guid VARCHAR(255) PRIMARY KEY,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_backup_timestamp VARCHAR(255) NULL,
    gender VARCHAR(50) NULL,
    birth_year INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Uric Acid Values Tabelle
CREATE TABLE IF NOT EXISTS uric_acid_values (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    timestamp BIGINT NOT NULL,
    value REAL NOT NULL,
    factor TEXT NULL,
    notes TEXT NULL,
    fasten INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(guid) ON DELETE CASCADE,
    UNIQUE(user_id, timestamp, value)
);

-- Meals Tabelle
CREATE TABLE IF NOT EXISTS meals (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    timestamp BIGINT NOT NULL,
    meal_type VARCHAR(50) NOT NULL,
    name TEXT NULL,
    photo_path TEXT NULL,
    thumbnail_path TEXT NULL,
    total_purin INTEGER NOT NULL DEFAULT 0,
    total_uric_acid INTEGER NOT NULL DEFAULT 0,
    total_calories INTEGER NOT NULL DEFAULT 0,
    total_protein REAL NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(guid) ON DELETE CASCADE,
    UNIQUE(user_id, timestamp, meal_type)
);

-- Meal Components Tabelle
CREATE TABLE IF NOT EXISTS meal_components (
    id SERIAL PRIMARY KEY,
    meal_id INTEGER NOT NULL,
    food_item_name TEXT NOT NULL,
    estimated_weight INTEGER NOT NULL,
    purin INTEGER NOT NULL,
    uric_acid INTEGER NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);

-- Food Items Tabelle
CREATE TABLE IF NOT EXISTS food_items (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name TEXT NOT NULL,
    purin_per_100g INTEGER NOT NULL,
    uric_acid_per_100g INTEGER NOT NULL,
    calories_per_100g INTEGER NOT NULL DEFAULT 0,
    protein_percentage REAL NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    image_path TEXT NULL,
    is_custom INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(guid) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

-- Indizes für bessere Performance
CREATE INDEX IF NOT EXISTS idx_uric_acid_user_timestamp ON uric_acid_values(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_meals_user_timestamp ON meals(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_meal_components_meal_id ON meal_components(meal_id);
CREATE INDEX IF NOT EXISTS idx_food_items_user_id ON food_items(user_id);

-- Kommentare für Dokumentation
COMMENT ON TABLE users IS 'Benutzer der Gout Diary App';
COMMENT ON TABLE uric_acid_values IS 'Harnsäurewerte der Benutzer';
COMMENT ON TABLE meals IS 'Mahlzeiten der Benutzer';
COMMENT ON TABLE meal_components IS 'Komponenten einer Mahlzeit';
COMMENT ON TABLE food_items IS 'Lebensmittel (benutzerdefiniert und Standard)';

