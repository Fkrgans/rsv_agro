# RSV Hydro-sense - Smart Hydroponics IoT System

A complete IoT and Agribusiness platform for real-time monitoring and control of hydroponic systems using Node.js (Express), WebSockets (Socket.io), HTML5, and Tailwind CSS.

## 🌱 Features

- **Real-time Sensor Monitoring**: pH Level, Nutrient Concentration (PPM), Temperature, Humidity
- **Interactive Dashboard**: Modern dark-themed dashboard with live metrics and charts
- **Hardware Control**: Remote actuator control (pumps, nutrient dosing) via toggle switches
- **WebSocket Communication**: Sub-second latency data updates via Socket.io
- **Data Visualization**: ApexCharts line graphs for sensor trends
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **ESP32/NodeMCU Support**: Complete firmware for sensor data transmission

## 📁 Project Structure

```
rsv-hydrosense/
├── config/
│   └── database.js                # Database configuration (optional for future use)
├── controllers/
│   └── sensorController.js        # Business logic for sensor operations
├── models/
│   └── SensorLog.js               # Database schema definition
├── public/
│   ├── css/
│   │   ├── style.css              # Tailwind compiled CSS
│   │   └── input.css              # Tailwind input file
│   ├── js/
│   │   ├── dashboard.js           # Frontend Socket.io + ApexCharts logic
│   │   └── main.js                # Landing page utilities
│   └── index.html                 # Landing page (Tailwind CSS)
├── views/
│   └── dashboard.html             # IoT Dashboard UI (Tailwind CSS)
├── hardware/
│   └── esp32_nodemcu.ino          # ESP32 firmware for sensor data transmission
├── server.js                      # Main Express + Socket.io server
├── package.json                   # Node.js dependencies
├── tailwind.config.js             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS configuration
├── .env                           # Environment variables
└── .gitignore                     # Git ignore rules
```

## 🚀 Quick Start

### Prerequisites
- Node.js v14 or higher
- npm or yarn
- Arduino IDE (for hardware upload)

### Installation

1. **Clone/Download the project**
```bash
cd c:\xampp\htdocs\agro_sense
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Edit `.env` file and update your server configuration:
```env
PORT=3000
NODE_ENV=development
```

4. **Start the server**
```bash
npm start
```

The server will start at `http://localhost:3000`

### Access the Application

- **Landing Page**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **API Endpoint**: `POST http://localhost:3000/api/sensor`

## 📊 API Endpoints

### Send Sensor Data
```
POST /api/sensor
Content-Type: application/json

{
  "ph": 6.8,
  "ppm": 1200,
  "temp": 24.5,
  "humidity": 65
}

Response:
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

### Get Latest Sensor Data
```
GET /api/sensor/latest

Response:
{
  "ph": 6.8,
  "ppm": 1200,
  "temp": 24.5,
  "humidity": 65,
  "timestamp": "2026-05-21T10:30:00.000Z"
}
```

## 🔌 Hardware Setup (ESP32/NodeMCU)

### Arduino Sketch Configuration

1. Install Arduino IDE and ESP32 boards
2. Open `hardware/esp32_nodemcu.ino`
3. Configure WiFi credentials:
```cpp
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
const char* serverUrl = "http://192.168.1.100:3000/api/sensor";
```

4. Adjust sensor pins as needed:
```cpp
#define PH_SENSOR_PIN 36      // ADC pin for pH sensor
#define PPM_SENSOR_PIN 39     // ADC pin for PPM/EC sensor
#define TEMP_SENSOR_PIN 34    // ADC pin for temperature sensor
#define HUMIDITY_SENSOR_PIN 35 // ADC pin for humidity sensor
```

5. Upload the sketch to your ESP32/NodeMCU

### Sensor Calibration

Calibrate sensors based on your specific hardware using the mapping equations in `readSensors()` function:
- pH: 0-1023 ADC → 0-14 pH units
- PPM: 0-1023 ADC → 0-2000 PPM
- Temperature: 0-1023 ADC → -40 to +125°C
- Humidity: 0-1023 ADC → 0-100%

## 🔌 Socket.io Events

### Client Events (Frontend to Backend)
```javascript
// Send control command to hardware
socket.emit('controlRelay', {
  relay: 'pump',        // 'pump' or 'nutrient'
  state: true,          // true = ON, false = OFF
  timestamp: Date.now()
});
```

### Server Events (Backend to Frontend)
```javascript
// Receive sensor updates
socket.on('updateSensor', (data) => {
  // data = { ph, ppm, temp, humidity, timestamp }
});

// Receive relay acknowledgement
socket.on('relayAcknoledged', (data) => {
  // data = { relay, state, success }
});

// Receive hardware commands
socket.on('hardwareCommand', (data) => {
  // data = { command, state, timestamp }
});
```

## 🎨 Customization

### Tailwind CSS Theme

Edit `tailwind.config.js` to customize colors:
```js
theme: {
  extend: {
    colors: {
      'leaf-green': '#2d5016',
      'fresh-green': '#48a868',
      'light-green': '#7cb342',
      'accent-blue': '#1e88e5'
    }
  }
}
```

### Build Tailwind CSS
```bash
npm run build:css
```

## 📱 Dashboard Features

- **Metric Cards**: Real-time display of pH, PPM, Temperature, Humidity with status badges
- **Trend Graph**: ApexCharts line chart showing 4 sensor series over time
- **System Status**: Real-time sensor health indicators
- **Hardware Controls**: Toggle switches for pump and nutrient dosing systems
- **Connection Status**: Visual indicator for server connection state
- **Data Export**: Export historical data as CSV

## 🔒 Security Considerations

1. Change default WiFi credentials in hardware sketch
2. Use HTTPS in production
3. Implement authentication for API endpoints (future enhancement)
4. Validate all incoming sensor data
5. Use environment variables for sensitive data

## 🚧 Development

### Start Development Server
```bash
npm run dev
```

This uses nodemon to automatically restart on file changes.

## 📝 License

MIT License - See LICENSE file

## 👥 Support

For issues and feature requests, please contact the RSV team.

## 📚 Technologies Used

- **Backend**: Express.js 4.18
- **Real-time**: Socket.io 4.5
- **Frontend**: HTML5, Tailwind CSS 3.3
- **Charts**: ApexCharts
- **Hardware**: Arduino C++ (ESP32/NodeMCU)
- **JSON**: ArduinoJson

---

🌱 **RSV Hydro-sense** - Smart Hydroponics for the Future
