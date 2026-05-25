# RSV Hydro-sense - Complete Architecture & Design

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ESP32/NodeMCU                           │
│                     (Sensor Transmitter)                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  pH Sensor   │ │ PPM Sensor   │ │Temp Humidity │            │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘            │
│         │                 │                │                    │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│                      WiFi.h / HTTPClient.h                      │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ HTTP POST /api/sensor
                            │ (JSON: {ph, ppm, temp, humidity})
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express.js Backend                           │
│                  (Node.js / Socket.io)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ app.post('/api/sensor', (req, res) => {                │   │
│  │   io.emit('updateSensor', data)  // <1s latency       │   │
│  │   res.json({ success: true })                          │   │
│  │ })                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ├──► io.emit('updateSensor')          │
│                           │    io.emit('hardwareCommand')       │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Socket.io Server                                        │   │
│  │ - connect / disconnect events                          │   │
│  │ - controlRelay event (from frontend)                   │   │
│  │ - updateSensor event (to frontend)                     │   │
│  │ - hardwareCommand event (to hardware)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   Browser            Browser            Chrome/Firefox
  Socket.io          Socket.io            WebSocket
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Landing    │  │  Dashboard   │  │  Dashboard   │
│    Page      │  │  (Client 1)  │  │  (Client 2)  │
│ (HTML/CSS)   │  │ (Real-time)  │  │ (Real-time)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

## 📊 Data Flow Diagram

### Sensor Data Transmission (Hardware → Backend)
```
Hardware (ESP32)
    │
    │ Every 5 seconds
    ▼
readSensors() {
    └─ Read analog pins
    └─ Map ADC to real values
    └─ Constrain values
}
    │
    ▼
sendSensorData() {
    └─ Create JSON: {ph, ppm, temp, humidity}
    └─ HTTP POST to /api/sensor
}
    │
    ▼
Backend (Express)
    │
    ▼ POST /api/sensor received
    │
    ├─ Validate input
    ├─ Update latestSensorData
    ├─ Broadcast via Socket.io
    │   └─ io.emit('updateSensor', data)
    │       ▼
    │   All connected clients receive data
    │       ▼
    │   updateMetrics(data)  // Update cards
    │   updateChart(data)    // Append to chart
    │   addToHistory(data)   // Store locally
    │
    └─ Send HTTP response (success)
```

### Hardware Control Flow (Frontend → Hardware)
```
Frontend Dashboard
    │
    ▼
User toggles relay switch
    │
    ▼
controlRelay(relay, state)
    │
    ├─ socket.emit('controlRelay', {relay, state})
    │   │
    │   ▼ (Socket.io)
    │
    └─ Backend receives 'controlRelay'
        │
        ├─ io.emit('hardwareCommand', {command, state})
        │   │
        │   ▼ (WebSocket)
        │
        └─ Hardware receives command
            └─ Execute relay operation
            └─ Send acknowledgement
```

## 🔗 API Endpoints

### 1. POST /api/sensor
**Purpose**: Receive sensor data from hardware and broadcast to frontend

**Request**:
```json
{
  "ph": 6.8,
  "ppm": 1200,
  "temp": 24.5,
  "humidity": 65
}
```

**Response**:
```json
{
  "success": true,
  "message": "Sensor data received and broadcasted",
  "data": {
    "ph": 6.8,
    "ppm": 1200,
    "temp": 24.5,
    "humidity": 65,
    "timestamp": "2026-05-21T10:30:00.000Z"
  }
}
```

**Latency**: <1 second (via Socket.io broadcast)

### 2. GET /api/sensor/latest
**Purpose**: Get the most recent sensor reading

**Response**:
```json
{
  "ph": 6.8,
  "ppm": 1200,
  "temp": 24.5,
  "humidity": 65,
  "timestamp": "2026-05-21T10:30:00.000Z"
}
```

### 3. GET /
**Purpose**: Serve landing page

**Response**: HTML (landing page with Tailwind CSS)

### 4. GET /dashboard
**Purpose**: Serve IoT dashboard

**Response**: HTML (dashboard UI with Tailwind CSS)

## 🔌 Socket.io Events

### Client Events (Frontend → Backend)
```javascript
// Control relay operation
socket.emit('controlRelay', {
  relay: 'pump',              // 'pump' or 'nutrient'
  state: true,                // true = ON, false = OFF
  timestamp: Date.now()
});
```

### Server Events (Backend → Frontend)
```javascript
// New sensor data available
socket.on('updateSensor', (data) => {
  // data = {
  //   ph: 6.8,
  //   ppm: 1200,
  //   temp: 24.5,
  //   humidity: 65,
  //   timestamp: "2026-05-21T10:30:00.000Z"
  // }
});

// Relay acknowledgement
socket.on('relayAcknoledged', (data) => {
  // data = {
  //   relay: 'pump',
  //   state: true,
  //   success: true
  // }
});

// Hardware command (sent to all ESP32 devices)
socket.on('hardwareCommand', (data) => {
  // data = {
  //   command: 'pump',
  //   state: true,
  //   timestamp: "2026-05-21T10:30:00.000Z"
  // }
});
```

## 🎯 Component Responsibilities

### Backend (server.js)
- Express HTTP server on port 3000
- REST API for sensor data reception
- Socket.io event broker
- Data validation
- Real-time broadcasting
- Route handling

### Frontend - Landing Page (public/index.html)
- Marketing website
- Feature showcase
- Call-to-action buttons
- Responsive Tailwind design
- Navigation links

### Frontend - Dashboard (views/dashboard.html)
- Dark theme UI
- Real-time metric display
- ApexCharts visualization
- Hardware control switches
- Connection status indicator
- System monitoring

### Frontend Logic (public/js/dashboard.js)
- Socket.io client connection
- Metric card updates
- Chart data management
- History tracking
- Control event handling
- Connection status management
- CSV data export

### Hardware (hardware/esp32_nodemcu.ino)
- WiFi connectivity
- Analog sensor reading
- ADC to real-value conversion
- HTTP POST transmission
- Status LED feedback
- Serial debugging
- Error handling

## 📈 Sensor Value Ranges

| Sensor | Unit | Min | Max | Ideal | Alarm |
|--------|------|-----|-----|-------|-------|
| pH | pH | 0 | 14 | 5.5-7.0 | <5.5, >7.5 |
| PPM | mg/L | 0 | 2000 | 1000-1500 | <800, >1800 |
| Temperature | °C | -40 | 125 | 20-28 | <15, >30 |
| Humidity | % | 0 | 100 | 60-80 | <40, >90 |

## 💾 Data Structure

### Sensor Data Object
```javascript
{
  ph: 6.8,              // float, 0-14
  ppm: 1200,            // integer, 0-2000
  temp: 24.5,           // float, -40-125°C
  humidity: 65,         // integer, 0-100%
  timestamp: "ISO8601"  // ISO 8601 timestamp
}
```

### Control Command Object
```javascript
{
  relay: "pump",        // "pump" or "nutrient"
  state: true,          // boolean (ON/OFF)
  timestamp: "ISO8601"  // ISO 8601 timestamp
}
```

## 🎨 UI Components

### Landing Page Sections
1. **Navigation Bar**: Logo, menu links, CTA button
2. **Hero Section**: Tagline, description, buttons
3. **Features Grid**: 3 columns (Sensors, Automation, Analytics)
4. **How It Works**: 4-step process
5. **Benefits**: 4 key advantages
6. **Footer**: Copyright, tech stack

### Dashboard Layout
1. **Sidebar**: Navigation (Overview, Control, History), connection status
2. **Header**: Title, system status
3. **Metric Cards**: 4 cards (pH, PPM, Temp, Humidity) with badges
4. **Chart Area**: ApexCharts line graph (2/3 width)
5. **Status Panel**: Sensor health (1/3 width)
6. **Control Panel**: Toggle switches for relays

## 🔐 Security Features

- ✅ Input validation on API endpoints
- ✅ CORS enabled for development
- ✅ Error handling and logging
- ✅ Environment variables for configuration
- ✅ WiFi credentials in hardware sketch
- ⚠️ TODO: Add authentication middleware
- ⚠️ TODO: Use HTTPS in production
- ⚠️ TODO: Add rate limiting

## 📊 Performance Specifications

| Metric | Value |
|--------|-------|
| API Latency | <100ms |
| Socket.io Broadcast | <1s |
| Chart Update | Real-time (no page refresh) |
| Data Update Interval | 5 seconds (hardware) |
| Max History Points | 50 (in browser) |
| Dashboard Load Time | ~1-2s |

## 🔄 Data Storage

### Frontend (Browser Memory)
- `sensorHistory[]`: Last 50 data points
- `latestSensorData{}`: Most recent reading
- Chart instance: ApexCharts series data

### Backend (In-Memory)
- `latestSensorData{}`: Most recent sensor reading

### Optional: Database
- Future enhancement for long-term storage
- MySQL schema prepared but not activated

## 🚀 Deployment Checklist

- [ ] Update WiFi credentials in hardware sketch
- [ ] Update server IP address in hardware sketch
- [ ] Test API endpoints with Postman
- [ ] Test Socket.io events in browser console
- [ ] Configure firewall rules
- [ ] Set NODE_ENV=production in .env
- [ ] Use HTTPS certificates
- [ ] Enable authentication
- [ ] Set up monitoring/logging
- [ ] Plan database schema for production

## 📝 Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Express.js | 4.18.2 |
| Real-time | Socket.io | 4.5.4 |
| Frontend | Tailwind CSS | 3.3.0 |
| Charts | ApexCharts | Latest |
| Hardware | Arduino C++ | ESP32/NodeMCU |
| Runtime | Node.js | 14+ |
| Build | PostCSS + Autoprefixer | Latest |

---

🌱 **RSV Hydro-sense** - IoT Architecture Documentation v1.0
