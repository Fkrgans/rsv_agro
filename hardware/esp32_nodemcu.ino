// RSV Hydro-sense IoT Device Firmware
// ESP32 / NodeMCU Sensor Data Transmitter
// Sends pH, PPM, Temperature, Humidity data via HTTP POST

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== WiFi Configuration =====
const char* ssid = "YOUR_SSID";           // Change to your WiFi SSID
const char* password = "YOUR_PASSWORD";   // Change to your WiFi password
const char* serverUrl = "http://192.168.1.100:3000/api/sensor";  // Change to your server IP

// ===== Sensor Pin Configuration =====
#define PH_SENSOR_PIN 36      // ADC pin for pH sensor (ESP32: 36=VP)
#define PPM_SENSOR_PIN 39     // ADC pin for PPM/EC sensor (ESP32: 39=VN)
#define TEMP_SENSOR_PIN 34    // ADC pin for temperature sensor
#define HUMIDITY_SENSOR_PIN 35 // ADC pin for humidity sensor

// ===== Timing Configuration =====
const unsigned long SEND_INTERVAL = 5000;  // Send data every 5 seconds
unsigned long lastSendTime = 0;

// ===== WiFi Status LED =====
#define STATUS_LED 2  // GPIO2 (built-in LED on most boards)

// ===== Sensor Calibration Values =====
// These should be calibrated based on your sensors
const float pH_MIN = 0.0;
const float pH_MAX = 14.0;
const int PPM_MIN = 0;
const int PPM_MAX = 2000;
const float TEMP_MIN = -40.0;
const float TEMP_MAX = 125.0;
const int HUMIDITY_MIN = 0;
const int HUMIDITY_MAX = 100;

// ===== Function Declarations =====
void setupWiFi();
void readSensors(float &ph, int &ppm, float &temp, int &humidity);
void sendSensorData(float ph, int ppm, float temp, int humidity);
void updateStatusLED(bool wifiConnected);

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n╔════════════════════════════════════════╗");
  Serial.println("║  🌱 RSV Hydro-sense IoT Device       ║");
  Serial.println("║  ESP32 / NodeMCU Firmware v1.0       ║");
  Serial.println("╚════════════════════════════════════════╝\n");

  // Initialize LED
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  // Initialize sensor pins
  pinMode(PH_SENSOR_PIN, INPUT);
  pinMode(PPM_SENSOR_PIN, INPUT);
  pinMode(TEMP_SENSOR_PIN, INPUT);
  pinMode(HUMIDITY_SENSOR_PIN, INPUT);

  // Connect to WiFi
  setupWiFi();
}

// ===== MAIN LOOP =====
void loop() {
  // Check WiFi connection and update LED
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED, HIGH);
    updateStatusLED(true);
  } else {
    digitalWrite(STATUS_LED, LOW);
    updateStatusLED(false);
    // Attempt to reconnect
    if (millis() - lastSendTime > 10000) {
      Serial.println("Reconnecting to WiFi...");
      setupWiFi();
    }
  }

  // Send sensor data at specified interval
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    float ph;
    int ppm;
    float temp;
    int humidity;

    readSensors(ph, ppm, temp, humidity);
    sendSensorData(ph, ppm, temp, humidity);

    lastSendTime = millis();
  }

  delay(100);  // Small delay to prevent overwhelming the loop
}

// ===== WIFI SETUP =====
void setupWiFi() {
  Serial.print("\n📡 Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("📍 IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("📶 Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm\n");
  } else {
    Serial.println("\n✗ Failed to connect to WiFi");
    Serial.println("⚠️  Will retry in 10 seconds...\n");
  }
}

// ===== READ SENSORS =====
void readSensors(float &ph, int &ppm, float &temp, int &humidity) {
  // Read analog values (10-bit ADC: 0-1023 on most boards)
  int phRaw = analogRead(PH_SENSOR_PIN);
  int ppmRaw = analogRead(PPM_SENSOR_PIN);
  int tempRaw = analogRead(TEMP_SENSOR_PIN);
  int humidityRaw = analogRead(HUMIDITY_SENSOR_PIN);

  // Convert ADC values to sensor readings
  // Using linear mapping (adjust these equations based on your specific sensors)
  
  // pH: Map 0-1023 to 0-14 pH units
  ph = map(phRaw, 0, 1023, 0, 1400) / 100.0;
  
  // PPM: Map 0-1023 to 0-2000 PPM
  ppm = map(ppmRaw, 0, 1023, 0, 2000);
  
  // Temperature: Map 0-1023 to -40 to +125°C (typical for analog temp sensors)
  temp = map(tempRaw, 0, 1023, -40, 125);
  
  // Humidity: Map 0-1023 to 0-100%
  humidity = map(humidityRaw, 0, 1023, 0, 100);

  // Apply constraints to ensure values stay within valid ranges
  ph = constrain(ph, pH_MIN, pH_MAX);
  ppm = constrain(ppm, PPM_MIN, PPM_MAX);
  temp = constrain(temp, TEMP_MIN, TEMP_MAX);
  humidity = constrain(humidity, HUMIDITY_MIN, HUMIDITY_MAX);

  // Debug output
  Serial.print("📊 Sensor Readings: ");
  Serial.print("pH=");
  Serial.print(ph, 2);
  Serial.print(" | PPM=");
  Serial.print(ppm);
  Serial.print(" | Temp=");
  Serial.print(temp, 1);
  Serial.print("°C | Humidity=");
  Serial.print(humidity);
  Serial.println("%");
}

// ===== SEND SENSOR DATA =====
void sendSensorData(float ph, int ppm, float temp, int humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected, skipping sensor data transmission");
    return;
  }

  HTTPClient http;

  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["ph"] = ph;
  doc["ppm"] = ppm;
  doc["temp"] = temp;
  doc["humidity"] = humidity;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.print("📤 Sending to server: ");
  Serial.println(serverUrl);

  // Set up HTTP POST request
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  // Send POST request
  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode > 0) {
    Serial.print("✓ HTTP Response Code: ");
    Serial.println(httpResponseCode);
    
    String response = http.getString();
    Serial.print("📩 Response: ");
    Serial.println(response);
  } else {
    Serial.print("❌ HTTP Error Code: ");
    Serial.println(httpResponseCode);
    Serial.print("Error: ");
    Serial.println(http.errorToString(httpResponseCode));
  }

  http.end();
  Serial.println("---");
}

// ===== UPDATE STATUS LED =====
void updateStatusLED(bool wifiConnected) {
  if (wifiConnected) {
    // Solid on when connected
    digitalWrite(STATUS_LED, HIGH);
  } else {
    // Blinking when disconnected
    digitalWrite(STATUS_LED, millis() % 1000 < 500 ? HIGH : LOW);
  }
}

/*
  ===== SETUP INSTRUCTIONS =====
  
  1. Arduino IDE Setup:
     - Install ESP32 board: https://github.com/espressif/arduino-esp32
     - Select board: Tools > Board > ESP32 Dev Module (or NodeMCU-32S for NodeMCU)
     - Select COM port
  
  2. Install Required Libraries:
     - Tools > Manage Libraries
     - Search and install: ArduinoJson
  
  3. Configure WiFi:
     - Replace "YOUR_SSID" and "YOUR_PASSWORD" with your network credentials
     - Replace server IP (192.168.1.100) with your actual server IP
  
  4. Sensor Calibration:
     - Connect your sensors to the analog pins specified above
     - Adjust the mapping equations in readSensors() based on your specific sensors
     - Calibrate using known reference values
  
  5. Upload:
     - Click Upload button or Ctrl+U
     - Open Serial Monitor to verify operation
  
  ===== EXPECTED SERIAL OUTPUT =====
  
  ╔════════════════════════════════════════╗
  ║  🌱 RSV Hydro-sense IoT Device       ║
  ║  ESP32 / NodeMCU Firmware v1.0       ║
  ╚════════════════════════════════════════╝
  
  📡 Connecting to WiFi: MyNetwork
  ...................✓ WiFi connected!
  📍 IP Address: 192.168.1.105
  📶 Signal Strength: -60 dBm
  
  📊 Sensor Readings: pH=6.80 | PPM=1200 | Temp=24.5°C | Humidity=65%
  📤 Sending to server: http://192.168.1.100:3000/api/sensor
  ✓ HTTP Response Code: 200
  📩 Response: {"success":true,"message":"Sensor data received and broadcasted"...}
  
  [Repeats every 5 seconds]
*/
