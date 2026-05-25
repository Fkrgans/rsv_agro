// RSV Hydro-sense Main Server File
// Express + Socket.io Backend for Smart Hydroponics IoT System

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');

// Load environment variables
dotenv.config();

// ===== Initialize Express & HTTP Server =====
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// ===== Middleware =====
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Store sensor data in memory (can be replaced with database)
let latestSensorData = {
  ph: 6.5,
  ppm: 1200,
  temp: 24.5,
  humidity: 65,
  timestamp: new Date()
};

// ===== Routes =====

// Landing Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Simple logout endpoint (no auth implemented yet)
app.get('/logout', (req, res) => {
  res.redirect('/');
});

// ===== API ENDPOINTS =====

/**
 * POST /api/sensor
 * Accepts sensor data from hardware: { ph, ppm, temp, humidity }
 */
app.post('/api/sensor', (req, res) => {
  const { ph, ppm, temp, humidity } = req.body;

  // Validate input
  if (ph === undefined || ppm === undefined || temp === undefined || humidity === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: ph, ppm, temp, humidity'
    });
  }

  // Update latest sensor data
  latestSensorData = {
    ph: parseFloat(ph),
    ppm: parseInt(ppm),
    temp: parseFloat(temp),
    humidity: parseInt(humidity),
    timestamp: new Date().toISOString()
  };

  console.log(`[Sensor Data] pH: ${ph}, PPM: ${ppm}, Temp: ${temp}°C, Humidity: ${humidity}%`);

  // Broadcast to all connected frontend clients via Socket.io
  io.emit('updateSensor', latestSensorData);

  // Return success response
  res.status(200).json({
    success: true,
    message: 'Sensor data received and broadcasted',
    data: latestSensorData
  });
});

/**
 * GET /api/sensor/latest
 * Get the latest sensor reading
 */
app.get('/api/sensor/latest', (req, res) => {
  res.json(latestSensorData);
});

// ===== Socket.IO EVENTS =====

io.on('connection', (socket) => {
  console.log(`[Socket.io] Device connected: ${socket.id}`);

  // Send latest sensor data to newly connected client
  socket.emit('updateSensor', latestSensorData);

  /**
   * Handle 'controlRelay' event from frontend
   */
  socket.on('controlRelay', (data) => {
    console.log(`[Control] Relay command from frontend:`, data);
    
    io.emit('hardwareCommand', {
      relay: data.relay,
      state: data.state,
      timestamp: new Date().toISOString()
    });

    socket.emit('relayAcknowledged', {
      relay: data.relay,
      state: data.state,
      success: true
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Device disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error(`[Socket.io Error]:`, error);
  });
});

// ===== Error Handling =====
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ===== Start Server =====
// Hanya dijalankan di lokal komputer (development), Vercel akan otomatis mengabaikan bagian ini
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔════════════════════════════════════════════════╗`);
    console.log(`║   🌱 RSV Hydro-sense IoT Backend Server        ║`);
    console.log(`║   Port: ${PORT}${' '.repeat(39 - PORT.toString().length)}║`);
    console.log(`║   Mode: ${process.env.NODE_ENV || 'development'}${' '.repeat(35)}║`);
    console.log(`╚════════════════════════════════════════════════╝\n`);
  });
}

// Export tunggal untuk runtime Serverless Vercel
module.exports = app;