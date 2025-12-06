const { getDatabase, getDbType } = require('./index');
const logger = require('../utils/logger');

/**
 * Datenbank-Adapter für einheitliche Schnittstelle zwischen PostgreSQL und SQLite
 */

class DatabaseAdapter {
  /**
   * Führt eine vorbereitete Query aus
   * @param {string} sql - SQL Query
   * @param {Array} params - Parameter für die Query
   * @returns {Object} - Result mit rows-Array
   */
  static async query(sql, params = []) {
    const db = getDatabase();
    const dbType = getDbType();

    if (dbType === 'postgres') {
      // Konvertiere SQLite-Platzhalter (?) zu PostgreSQL-Platzhalter ($1, $2, ...)
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

      // Konvertiere CURRENT_TIMESTAMP für PostgreSQL
      pgSql = pgSql.replace(/CURRENT_TIMESTAMP/g, 'CURRENT_TIMESTAMP');

      // Konvertiere INTEGER zu BOOLEAN für PostgreSQL
      pgSql = pgSql.replace(/INTEGER DEFAULT 0/gi, 'BOOLEAN DEFAULT FALSE');
      pgSql = pgSql.replace(/INTEGER DEFAULT 1/gi, 'BOOLEAN DEFAULT TRUE');

      const result = await db.query(pgSql, params);
      return { rows: result.rows || [] };
    } else {
      // SQLite
      const stmt = db.db.prepare(sql);

      // Prüfe ob SELECT query
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = stmt.all(...params);
        return { rows };
      } else {
        const info = stmt.run(...params);
        return { rows: [], changes: info.changes, lastInsertRowid: info.lastInsertRowid };
      }
    }
  }

  /**
   * Holt eine einzelne Zeile
   * @param {string} sql - SQL Query
   * @param {Array} params - Parameter
   * @returns {Object|null} - Ergebnis-Objekt oder null
   */
  static async get(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Holt alle Zeilen
   * @param {string} sql - SQL Query
   * @param {Array} params - Parameter
   * @returns {Array} - Array von Ergebnis-Objekten
   */
  static async all(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows || [];
  }

  /**
   * Führt eine INSERT/UPDATE/DELETE Query aus
   * @param {string} sql - SQL Query
   * @param {Array} params - Parameter
   * @returns {Object} - {changes, lastInsertRowid}
   */
  static async run(sql, params = []) {
    const db = getDatabase();
    const dbType = getDbType();

    if (dbType === 'postgres') {
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

      // Für INSERT mit RETURNING id
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        if (!pgSql.includes('RETURNING')) {
          pgSql += ' RETURNING id';
        }
      }

      const result = await db.query(pgSql, params);

      return {
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows && result.rows.length > 0 ? result.rows[0].id : null
      };
    } else {
      const stmt = db.db.prepare(sql);
      const info = stmt.run(...params);
      return {
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid
      };
    }
  }

  /**
   * Konvertiert Boolean-Werte zwischen PostgreSQL und SQLite
   * @param {any} value - Wert zum Konvertieren
   * @param {string} direction - 'toDb' oder 'fromDb'
   * @returns {any} - Konvertierter Wert
   */
  static convertBoolean(value, direction = 'toDb') {
    const dbType = getDbType();

    if (dbType === 'postgres') {
      // PostgreSQL verwendet echte Booleans
      return value;
    } else {
      // SQLite verwendet INTEGER (0/1)
      if (direction === 'toDb') {
        return value ? 1 : 0;
      } else {
        return value === 1 || value === true;
      }
    }
  }

  /**
   * Erstellt eine prepared statement
   * @param {string} sql - SQL Query
   * @returns {Object} - Prepared statement object
   */
  static prepare(sql) {
    const db = getDatabase();
    const dbType = getDbType();

    if (dbType === 'postgres') {
      // Für PostgreSQL: Return ein Objekt mit gleicher API wie SQLite
      return {
        get: async (...params) => {
          return await DatabaseAdapter.get(sql, params);
        },
        all: async (...params) => {
          return await DatabaseAdapter.all(sql, params);
        },
        run: async (...params) => {
          return await DatabaseAdapter.run(sql, params);
        }
      };
    } else {
      // SQLite: Return native prepared statement
      return db.db.prepare(sql);
    }
  }

  /**
   * Führt SQL direkt aus (für CREATE TABLE, etc.)
   * @param {string} sql - SQL Statement
   */
  static async exec(sql) {
    const db = getDatabase();
    const dbType = getDbType();

    if (dbType === 'postgres') {
      let pgSql = sql;

      // Konvertiere SQLite INTEGER zu PostgreSQL BOOLEAN für bestimmte Felder
      pgSql = pgSql.replace(/is_admin INTEGER DEFAULT 0/gi, 'is_admin BOOLEAN DEFAULT FALSE');
      pgSql = pgSql.replace(/is_active INTEGER DEFAULT 1/gi, 'is_active BOOLEAN DEFAULT TRUE');
      pgSql = pgSql.replace(/normal INTEGER DEFAULT 0/gi, 'normal BOOLEAN DEFAULT FALSE');
      pgSql = pgSql.replace(/much_meat INTEGER DEFAULT 0/gi, 'much_meat BOOLEAN DEFAULT FALSE');
      pgSql = pgSql.replace(/much_sport INTEGER DEFAULT 0/gi, 'much_sport BOOLEAN DEFAULT FALSE');
      pgSql = pgSql.replace(/much_sugar INTEGER DEFAULT 0/gi, 'much_sugar BOOLEAN DEFAULT FALSE');
      pgSql = pgSql.replace(/much_alcohol INTEGER DEFAULT 0/gi, 'much_alcohol BOOLEAN DEFAULT FALSE');
      pgSql = pgSql.replace(/fasten INTEGER DEFAULT 0/gi, 'fasten BOOLEAN DEFAULT FALSE');
      pgSql = pgSql.replace(/gout_attack INTEGER DEFAULT 0/gi, 'gout_attack BOOLEAN DEFAULT FALSE');

      // Konvertiere DATETIME zu TIMESTAMPTZ
      pgSql = pgSql.replace(/DATETIME/g, 'TIMESTAMPTZ');

      await db.query(pgSql);
    } else {
      db.db.exec(sql);
    }
  }

  /**
   * Beginnt eine Transaktion
   */
  static async beginTransaction() {
    const db = getDatabase();
    const dbType = getDbType();

    if (dbType === 'postgres') {
      await db.query('BEGIN');
    } else {
      db.db.exec('BEGIN');
    }
  }

  /**
   * Commitet eine Transaktion
   */
  static async commit() {
    const db = getDatabase();
    const dbType = getDbType();

    if (dbType === 'postgres') {
      await db.query('COMMIT');
    } else {
      db.db.exec('COMMIT');
    }
  }

  /**
   * Rollt eine Transaktion zurück
   */
  static async rollback() {
    const db = getDatabase();
    const dbType = getDbType();

    if (dbType === 'postgres') {
      await db.query('ROLLBACK');
    } else {
      db.db.exec('ROLLBACK');
    }
  }
}

module.exports = DatabaseAdapter;
