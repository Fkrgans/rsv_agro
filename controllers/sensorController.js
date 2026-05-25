// Sensor Controller - Logika bisnis untuk proses data sensor & kendali aktuator
const pool = require('../config/database');
const SensorLog = require('../models/SensorLog');

class SensorController {
  // Mendapatkan semua data sensor
  static async getAllSensors() {
    try {
      const sensors = await SensorLog.getAll();
      return sensors;
    } catch (error) {
      console.error('Error getting all sensors:', error);
      throw error;
    }
  }

  // Mendapatkan data sensor terbaru
  static async getLatestSensor() {
    try {
      const latestSensor = await SensorLog.getLatest();
      return latestSensor;
    } catch (error) {
      console.error('Error getting latest sensor:', error);
      throw error;
    }
  }

  // Menyimpan data sensor baru
  static async saveSensorData(data) {
    try {
      const result = await SensorLog.create(data);
      return result;
    } catch (error) {
      console.error('Error saving sensor data:', error);
      throw error;
    }
  }

  // Menghapus data sensor
  static async deleteSensorData(id) {
    try {
      const result = await SensorLog.delete(id);
      return result;
    } catch (error) {
      console.error('Error deleting sensor data:', error);
      throw error;
    }
  }
}

module.exports = SensorController;
