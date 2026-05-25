# RSV Hydro-sense - Installation & Setup Guide

## ✅ Project Structure Created

Your project has been successfully set up with the following complete structure:

```
rsv-hydrosense/
├── 📂 config/
│   └── database.js                # Database configuration (for future use)
├── 📂 controllers/
│   └── sensorController.js        # Business logic layer
├── 📂 models/
│   └── SensorLog.js               # Data schema definition
├── 📂 public/
│   ├── 📂 css/
│   │   ├── style.css              # Tailwind compiled output
│   │   └── input.css              # Tailwind input source
│   ├── 📂 js/
│   │   ├── dashboard.js           # Frontend Socket.io + ApexCharts
│   │   └── main.js                # Landing page utilities
│   └── index.html                 # 🌱 Landing Page (Tailwind CSS)
├── 📂 views/
│   └── dashboard.html             # 📊 IoT Dashboard (Tailwind CSS)
├── 📂 hardware/
│   └── esp32_nodemcu.ino          # Arduino firmware for ESP32/NodeMCU
├── 📄 server.js                   # Express + Socket.io backend
├── 📄 package.json                # Dependencies (updated)
├── 📄 tailwind.config.js          # Tailwind CSS config
├── 📄 postcss.config.js           # PostCSS config
├── 📄 .env                        # Environment variables
├── 📄 .gitignore                  # Git ignore rules
└── 📄 README.md                   # Full documentation
```

## 🚀 Installation Steps

### Step 1: Install Node.js Dependencies

```bash
cd c:\xampp\htdocs\agro_sense
npm install
```

⚠️ If npm install fails, try:
```bash
npm cache clean --force
npm install
```

### Step 2: Configure Environment (Optional)

Edit the `.env` file:
```
PORT=3000
NODE_ENV=development
```

### Step 3: Start the Server

```bash
npm start
```

Expected output:
```
╔════════════════════════════════════════════════╗
║  🌱 RSV Hydro-sense IoT Backend Server        ║
║  Port: 3000                                    ║
║  Mode: development                             ║
╚════════════════════════════════════════════════╝

📍 Available Routes:
   🏠 Landing Page: http://localhost:3000
   📊 Dashboard: http://localhost:3000/dashboard
   📡 API Sensor: POST http://localhost:3000/api/sensor
   📈 Latest Data: http://localhost:3000/api/sensor/latest
```

### Step 4: Access the Application

- **Landing Page**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard

## 🔧 Core Components

### 1. **Backend Architecture (server.js)**
- Express HTTP server
- Socket.io for real-time bi-directional communication
- REST API endpoint: `POST /api/sensor`
- Broadcasts incoming sensor data to all connected clients
- Handles control commands for relay/actuators
- **Latency**: <1 second

### 2. **Landing Page (public/index.html)**
- Modern green/nature theme
- Tailwind CSS responsive design
- 3-column feature grid (Smart Sensors, Automation, Analytics)
- 4-step how-it-works section
- Call-to-action buttons linking to dashboard

### 3. **IoT Dashboard (views/dashboard.html + public/js/dashboard.js)**

#### UI Features:
- **Dark sidebar** with navigation menu
- **4 metric cards** with real-time values:
  - 🧪 pH Level (ideal: 5.5-7.0)
  - 🧂 Nutrient Level / PPM (target: 1000-1500)
  - 🌡️ Temperature (ideal: 20-28°C)
  - 💧 Humidity (target: 60-80%)
  
- **ApexCharts line graph** displaying 4 sensor series
- **System status panel** showing sensor health
- **Hardware control panel** with toggle switches:
  - Pompa Sirkulasi (Water Circulation Pump)
  - Dosing Nutrisi (Nutrient Dosing System)

#### Real-time Updates:
- Socket.io client listening for `updateSensor` events
- Chart data appended dynamically without page refresh
- Status badges change based on thresholds
- Connection indicator shows server status

### 4. **Hardware Firmware (hardware/esp32_nodemcu.ino)**

#### Features:
- WiFi connectivity via WiFi.h
- HTTP POST requests every 5 seconds
- Analog sensor reading from 4 pins
- ADC value mapping to real-world units
- JSON payload transmission
- Status LED feedback (solid=connected, blinking=disconnected)
- Serial debugging output

#### Sensor Data Sent:
```json
{
  "ph": 6.8,        // 0-14 pH units
  "ppm": 1200,      // 0-2000 nutrient concentration
  "temp": 24.5,     // -40 to +125°C
  "humidity": 65    // 0-100%
}
```

## 📡 API Usage Examples

### Send Sensor Data (Hardware to Backend)
```bash
curl -X POST http://localhost:3000/api/sensor \
  -H "Content-Type: application/json" \
  -d '{
    "ph": 6.8,
    "ppm": 1200,
    "temp": 24.5,
    "humidity": 65
  }'
```

### Get Latest Sensor Reading
```bash
curl http://localhost:3000/api/sensor/latest
```

## 🔌 Hardware Setup

### Required Components:
- ESP32 or NodeMCU board
- Analog pH sensor
- EC/PPM sensor
- Temperature sensor
- Humidity sensor
- WiFi connection

### Setup Steps:
1. Open Arduino IDE
2. Install ESP32 boards: https://github.com/espressif/arduino-esp32
3. Open `hardware/esp32_nodemcu.ino`
4. Update WiFi credentials
5. Update server IP address
6. Calibrate sensor pins
7. Upload to board

## 🎨 Tailwind CSS Customization

### Edit Colors
Edit `tailwind.config.js`:
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

### Build CSS
```bash
npm run build:css
```

## 🧪 Testing

### Test Backend API
```bash
# Send test sensor data
curl -X POST http://localhost:3000/api/sensor \
  -H "Content-Type: application/json" \
  -d '{"ph":7.0,"ppm":1200,"temp":25,"humidity":70}'

# Check if data was broadcasted to frontend
# Open http://localhost:3000/dashboard and observe metric cards update
```

### Test Hardware Connection
1. Upload firmware to ESP32
2. Open Arduino Serial Monitor
3. Should see connection logs and sensor readings every 5 seconds

## 📊 Dashboard Features

✅ Real-time metric updates (Socket.io)
✅ Interactive ApexCharts visualization
✅ Hardware relay control with toggle switches
✅ Connection status indicator
✅ Status badges (Optimal/Warning/Critical)
✅ System health monitoring
✅ Responsive dark theme
✅ Sub-second latency

## 🔒 Security Notes

1. Change WiFi credentials in hardware sketch
2. Use HTTPS in production
3. Consider adding authentication (future)
4. Validate all API inputs
5. Use .env for sensitive data

## 📝 File Reference

| File | Purpose | Status |
|------|---------|--------|
| server.js | Main backend | ✅ Ready |
| public/index.html | Landing page | ✅ Ready |
| views/dashboard.html | Dashboard UI | ✅ Ready |
| public/js/dashboard.js | Frontend logic | ✅ Ready |
| hardware/esp32_nodemcu.ino | Hardware firmware | ✅ Ready |
| package.json | Dependencies | ✅ Updated |
| tailwind.config.js | CSS config | ✅ Ready |
| .env | Environment vars | ✅ Ready |

## ❓ Troubleshooting

### npm install fails
```bash
npm cache clean --force
npm install
```

### Port 3000 already in use
```bash
# Change PORT in .env file
PORT=3001
```

### Hardware not connecting
1. Check WiFi credentials in sketch
2. Verify server IP address is correct
3. Check serial monitor for error messages
4. Ensure ESP32 has internet connection

## 📚 Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Start server: `npm start`
3. ✅ Visit landing page: http://localhost:3000
4. ✅ Access dashboard: http://localhost:3000/dashboard
5. ✅ Configure hardware and upload firmware
6. ✅ Test sensor data transmission
7. ✅ Monitor real-time updates on dashboard

## 🎓 Learning Resources

- Express.js: https://expressjs.com
- Socket.io: https://socket.io
- Tailwind CSS: https://tailwindcss.com
- ApexCharts: https://apexcharts.com
- Arduino ESP32: https://docs.espressif.com

---

🌱 **RSV Hydro-sense** - Smart IoT Hydroponics Platform
