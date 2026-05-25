// Sensor Log Model - Struktur tabel database (Skema Data)
const pool = require('../config/database');

class SensorLog {
  // Membuat tabel jika belum ada
  static async createTable() {
    const connection = await pool.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS sensor_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          humidity FLOAT NOT NULL,
          temperature FLOAT NOT NULL,
          light_intensity FLOAT NOT NULL,
          soil_moisture FLOAT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_timestamp (timestamp)
        )
      `);
    } catch (error) {
      console.error('Error creating table:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Mendapatkan semua data sensor
  static async getAll() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query('SELECT * FROM sensor_logs ORDER BY timestamp DESC');
      return rows;
    } catch (error) {
      console.error('Error getting all sensors:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Mendapatkan data sensor terbaru
  static async getLatest() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query('SELECT * FROM sensor_logs ORDER BY timestamp DESC LIMIT 1');
      return rows[0];
    } catch (error) {
      console.error('Error getting latest sensor:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Membuat record baru
  static async create(data) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        'INSERT INTO sensor_logs (humidity, temperature, light_intensity, soil_moisture) VALUES (?, ?, ?, ?)',
        [data.humidity, data.temperature, data.light_intensity, data.soil_moisture]
      );
      return result;
    } catch (error) {
      console.error('Error creating sensor log:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Menghapus record
  static async delete(id) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query('DELETE FROM sensor_logs WHERE id = ?', [id]);
      return result;
    } catch (error) {
      console.error('Error deleting sensor log:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = SensorLog;
