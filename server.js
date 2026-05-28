// RSV Hydro-sense Main Server File
// Express + Socket.io Backend for Smart Hydroponics IoT System

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const https = require('https');
const mqtt = require('mqtt');

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
  timestamp: new Date().toISOString()
};

const alertCooldownMs = 5 * 60 * 1000;
const lastAlertTime = {
  generic: 0
};
const hardwareState = {
  pump: false,
  doser: false,
  lights: false,
  fan: false,
  uv: false,
  'ph-pump': false
};

const mqttConfig = {
  // Use the same broker as the ESP8266 firmware so dashboard relay commands reach the device.
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883',
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
  clientId: process.env.MQTT_CLIENT_ID || `agro-sense-server-${Math.random().toString(16).slice(2)}`,
  sensorTopic: process.env.MQTT_SENSOR_TOPIC || 'agro_sense/sensor',
  relayCommandTopic: process.env.MQTT_RELAY_COMMAND_TOPIC || 'agro_sense/relay/set',
  relayStateTopic: process.env.MQTT_RELAY_STATE_TOPIC || 'agro_sense/relay/state'
};

let mqttClient = null;
let mqttConnected = false;

function initMqttClient() {
  if (!mqttConfig.brokerUrl) return;

  const mqttOptions = {
    clientId: mqttConfig.clientId,
    clean: true,
    reconnectPeriod: 5000,
  };

  if (mqttConfig.username) {
    mqttOptions.username = mqttConfig.username;
  }
  if (mqttConfig.password) {
    mqttOptions.password = mqttConfig.password;
  }

  mqttClient = mqtt.connect(mqttConfig.brokerUrl, mqttOptions);

  mqttClient.on('connect', () => {
    mqttConnected = true;
    console.log('[MQTT] Connected to broker', mqttConfig.brokerUrl);
    mqttClient.subscribe([mqttConfig.sensorTopic, mqttConfig.relayStateTopic], { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] Subscribe error:', err.message);
      } else {
        console.log('[MQTT] Subscribed to topics', mqttConfig.sensorTopic, mqttConfig.relayStateTopic);
      }
    });
  });

  mqttClient.on('reconnect', () => {
    console.log('[MQTT] Reconnecting to broker...');
  });

  mqttClient.on('error', (err) => {
    mqttConnected = false;
    console.error('[MQTT] Error:', err.message);
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
    console.log('[MQTT] Connection closed');
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (topic === mqttConfig.sensorTopic) {
        latestSensorData = {
          ph: payload.ph !== undefined ? parseFloat(payload.ph) : latestSensorData.ph,
          ppm: payload.ppm !== undefined ? parseInt(payload.ppm) : latestSensorData.ppm,
          temp: payload.temp !== undefined ? parseFloat(payload.temp) : latestSensorData.temp,
          humidity: payload.humidity !== undefined ? parseInt(payload.humidity) : latestSensorData.humidity,
          timestamp: payload.timestamp || new Date().toISOString()
        };
        console.log('[MQTT] Sensor data received', latestSensorData);
        io.emit('updateSensor', latestSensorData);

        const alertMessage = createAlertMessage(latestSensorData);
        if (alertMessage && canSendAlert()) {
          sendTelegramMessage(alertMessage)
            .then((result) => console.log('Telegram alert sent:', result))
            .catch((err) => console.error('Telegram alert failed:', err.message));
          io.emit('sensorAlert', { message: alertMessage, data: latestSensorData });
        }
      }
      if (topic === mqttConfig.relayStateTopic && typeof payload.relay !== 'undefined') {
        const relayId = String(payload.relay);
        hardwareState[relayId] = !!payload.state;
        io.emit('hardwareCommand', {
          relay: relayId,
          state: hardwareState[relayId],
          timestamp: payload.timestamp || new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[MQTT] Invalid message format', err.message);
    }
  });
}

function publishMqtt(topic, payload) {
  if (!mqttClient || !mqttConnected) return false;
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (err) => {
    if (err) console.error('[MQTT] Publish error:', err.message);
  });
  return true;
}

function canSendAlert(key = 'generic') {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return false;
  const now = Date.now();
  if (now - (lastAlertTime[key] || 0) < alertCooldownMs) return false;
  lastAlertTime[key] = now;
  return true;
}

function sendTelegramMessage(message) {
  return new Promise((resolve, reject) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return reject(new Error('Telegram configuration is incomplete'));
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    const parsedUrl = new URL(url);
    const options = {
      method: 'POST',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`Telegram API failed ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

function createAlertMessage(data) {
  const problems = [];
  if (data.ph !== undefined && (data.ph < 5.5 || data.ph > 7.0)) {
    problems.push(`pH ${data.ph.toFixed(1)} (ideal 5.5–7.0)`);
  }
  if (data.ppm !== undefined && (data.ppm < 800 || data.ppm > 1800)) {
    problems.push(`PPM ${data.ppm} (ideal 800–1800)`);
  }
  if (data.temp !== undefined && (data.temp < 20 || data.temp > 34.2)) {
    problems.push(`Temperature ${data.temp.toFixed(1)}°C (ideal 20–34.2°C)`);
  }
  if (data.humidity !== undefined && (data.humidity < 40 || data.humidity > 75)) {
    problems.push(`Humidity ${data.humidity}% (ideal 40–75%)`);
  }
  if (!problems.length) return null;

  return `⚠️ RSV Hydro-sense Alert:\n${problems.join('\n')}\n\nLatest readings:\npH: ${data.ph ?? '—'}\nPPM: ${data.ppm ?? '—'}\nTemp: ${data.temp ?? '—'}°C\nHumidity: ${data.humidity ?? '—'}%\nTime: ${new Date(data.timestamp).toLocaleString()}`;
}

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

  // Validate minimum input for a working DHT/ESP8266 sensor
  if (temp === undefined || humidity === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: temp, humidity'
    });
  }

  latestSensorData = {
    ph: ph !== undefined ? parseFloat(ph) : latestSensorData.ph,
    ppm: ppm !== undefined ? parseInt(ppm) : latestSensorData.ppm,
    temp: parseFloat(temp),
    humidity: parseInt(humidity),
    timestamp: new Date().toISOString()
  };

  console.log(`[Sensor Data] pH: ${latestSensorData.ph}, PPM: ${latestSensorData.ppm}, Temp: ${latestSensorData.temp}°C, Humidity: ${latestSensorData.humidity}%`);

  // Broadcast to all connected frontend clients via Socket.io
  io.emit('updateSensor', latestSensorData);

  const alertMessage = createAlertMessage(latestSensorData);
  if (alertMessage && canSendAlert()) {
    sendTelegramMessage(alertMessage)
      .then((result) => console.log('Telegram alert sent:', result))
      .catch((err) => console.error('Telegram alert failed:', err.message));
    io.emit('sensorAlert', { message: alertMessage, data: latestSensorData });
  }

  // Return success response
  res.status(200).json({
    success: true,
    message: 'Sensor data received and broadcasted',
    data: latestSensorData
  });
});

/**
 * GET /api/telegram/test
 * Send a test Telegram message using configured bot credentials.
 */
app.get('/api/telegram/test', (req, res) => {
  const message = req.query.message || '✅ Test alert from RSV Hydro-sense';

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      success: false,
      message: 'Telegram bot token or chat ID is not configured.'
    });
  }

  sendTelegramMessage(message)
    .then((result) => {
      res.json({ success: true, message: 'Telegram test message sent.', result });
    })
    .catch((err) => {
      console.error('Telegram test failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    });
});

app.get('/api/hardware/relay', (req, res) => {
  res.json({ success: true, relays: hardwareState });
});

app.post('/api/hardware/relay', (req, res) => {
  const { relay, state } = req.body;
  if (!relay) {
    return res.status(400).json({ success: false, message: 'Relay id is required.' });
  }
  const relayId = String(relay);
  hardwareState[relayId] = !!state;
  const relayMessage = {
    relay: relayId,
    state: hardwareState[relayId],
    timestamp: new Date().toISOString()
  };
  io.emit('hardwareCommand', relayMessage);
  if (mqttConnected) {
    publishMqtt(mqttConfig.relayCommandTopic, relayMessage);
  }
  res.json({ success: true, relay: relayMessage });
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
    const relayId = String(data.relay || 'main');
    const relayMessage = {
      relay: relayId,
      state: !!data.state,
      timestamp: new Date().toISOString()
    };

    hardwareState[relayId] = relayMessage.state;

    io.emit('hardwareCommand', relayMessage);
    socket.emit('relayAcknowledged', {
      ...relayMessage,
      success: true
    });

    if (mqttConnected) {
      publishMqtt(mqttConfig.relayCommandTopic, relayMessage);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Device disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error(`[Socket.io Error]:`, error);
  });
});

initMqttClient();

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