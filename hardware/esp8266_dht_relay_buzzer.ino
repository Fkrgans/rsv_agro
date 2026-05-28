#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ===== WiFi Configuration =====
const char* ssid = "Ipul";            // Ganti dengan SSID WiFi Anda
const char* password = "12312312";    // Ganti dengan password WiFi Anda

// ===== MQTT Configuration =====
const char* mqttBrokerHost = "broker.hivemq.com"; 
const int mqttPort = 1883;
const char* mqttUser = "";
const char* mqttPassword = "";
const char* mqttClientId = "agro-sense-esp8266-001";
const char* sensorTopic = "agro_sense/sensor";
const char* relayTopic = "agro_sense/relay/set";
const char* relayStateTopic = "agro_sense/relay/state";
const char* relayId = "pump"; // ID unik untuk relay ini, cocokkan dengan data-act di dashboard
const bool RELAY_ACTIVE_LOW = true; // Ubah ke false hanya jika modul relay aktif HIGH

// ===== Sensor / Actuator Pins =====
#define DHTPIN D2             // Pin DHT sensor
#define RELAY_PIN D1          // Pin relay
#define BUZZER_PIN D3         // Pin buzzer
#define DHTTYPE DHT11         // Menggunakan DHT11

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

const unsigned long SENSOR_INTERVAL = 1000;
unsigned long lastSensorSend = 0;

// Batas Sensor untuk Aktifkan Sirine
const float TEMP_LOW = 20.0;
const float TEMP_HIGH = 34.2; // Buzzer akan aktif saat suhu di atas 34.2°C
const int HUM_LOW = 40;
const int HUM_HIGH = 75;

// Variabel Pendukung Relay
bool currentRelayState = false;

// Variabel Pendukung Sirine Buzzer (Non-Blocking)
bool isAlerting = false;
unsigned long lastSirineUpdate = 0;
const unsigned long SIRINE_INTERVAL = 4; // Kecepatan perubahan nada (makin kecil makin cepat)
int sirineFrequency = 500;               // Frekuensi awal (Hz)
bool frequencyRising = true;             // Menentukan arah nada (naik/turun)

void connectWiFi();
void connectMqtt();
void sendSensorData(float temperature, float humidity);
void mqttCallback(char* topic, byte* payload, unsigned int length);
void checkAlertStatus(float temperature, int humidity);
void handleSirine();

void setRelay(bool on) {
  currentRelayState = on;
  bool pinOn = RELAY_ACTIVE_LOW ? !on : on;
  digitalWrite(RELAY_PIN, pinOn ? HIGH : LOW);
  Serial.printf("🔌 Relay %s -> %s (pin %s)\n", relayId, on ? "ON" : "OFF", pinOn ? "HIGH" : "LOW");
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // Relay OFF when active-low module is used
  setRelay(false);                // Pastikan relay OFF saat startup
  noTone(BUZZER_PIN);            // Sirine mati saat awal

  dht.begin();
  connectWiFi();

  mqttClient.setServer(mqttBrokerHost, mqttPort);
  mqttClient.setCallback(mqttCallback);
  connectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    connectMqtt();
  }
  mqttClient.loop();

  // Efek suara sirine diproses terus menerus di sini jika status ALERT aktif
  handleSirine();

  unsigned long now = millis();
  if (now - lastSensorSend >= SENSOR_INTERVAL) {
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("❌ Gagal membaca sensor DHT");
    } else {
      sendSensorData(temperature, humidity);
      checkAlertStatus(temperature, (int)humidity); // Cek ambang batas sensor
    }
    lastSensorSend = now;
  }
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("📡 Menghubungkan ke WiFi: %s\n", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi terhubung");
    Serial.print("📍 IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ WiFi gagal terhubung, coba lagi...");
  }
}

void connectMqtt() {
  if (mqttClient.connected()) return;

  Serial.printf("🔌 Menghubungkan ke MQTT broker: %s:%d\n", mqttBrokerHost, mqttPort);
  while (!mqttClient.connected()) {
    if (mqttUser && mqttPassword && strlen(mqttUser) > 0) {
      if (mqttClient.connect(mqttClientId, mqttUser, mqttPassword)) {
        break;
      }
    } else {
      if (mqttClient.connect(mqttClientId)) {
        break;
      }
    }
    Serial.print(".");
    delay(2000);
  }

  Serial.println("\n✓ MQTT broker connected");
  mqttClient.subscribe(relayTopic);
  setRelay(false); // Pastikan relay OFF setelah subscribe, karena retained MQTT bisa memicu state lama

  // Reset retained relay command jika ada pesan retained lama di broker
  StaticJsonDocument<128> clearCmd;
  clearCmd["relay"] = relayId;
  clearCmd["state"] = false;
  uint8_t clearBuf[128];
  size_t clearLen = serializeJson(clearCmd, clearBuf);
  mqttClient.publish(relayTopic, clearBuf, clearLen, true);

  Serial.printf("✅ Subscribed to relay topic: %s\n", relayTopic);
}

void sendSensorData(float temperature, float humidity) {
  StaticJsonDocument<256> doc;
  doc["temp"] = temperature;
  doc["humidity"] = humidity;
  doc["timestamp"] = millis();

  char buffer[256];
  size_t len = serializeJson(doc, buffer);

  bool sent = mqttClient.publish(sensorTopic, buffer, len);
  if (sent) {
    Serial.printf("📤 Data sensor dikirim ke MQTT: %s\n", sensorTopic);
  } else {
    Serial.println("❌ Gagal mengirim data sensor ke MQTT");
  }
}

// ===== KONTROL RELAY HANYA BISA DIKONTROL DASHBOARD =====
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  payload[length] = '\0';
  Serial.printf("📩 MQTT message received on %s: %s\n", topic, payload);

  if (strcmp(topic, relayTopic) != 0) return;

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload);
  if (error) {
    Serial.println("⚠️ Payload relay bukan JSON valid");
    return;
  }

  const char* targetRelay = doc["relay"] | "";
  bool state = doc["state"] | false;
  if (strcmp(targetRelay, relayId) != 0 && strcmp(targetRelay, "all") != 0) {
    Serial.printf("⚠️ Relay-id tidak cocok: %s\n", targetRelay);
    return;
  }

  // Mengubah status relay berdasarkan dashboard MQTT
  setRelay(state);

  // Kirim feedback balik ke dashboard sebagai konfirmasi status
  StaticJsonDocument<128> ack;
  ack["relay"] = relayId;
  ack["state"] = state;
  ack["timestamp"] = millis();
  char ackBuf[128];
  size_t ackLen = serializeJson(ack, ackBuf);
  mqttClient.publish(relayStateTopic, ackBuf, ackLen);
}

// ===== FUNGSI DETEKSI KONDISI BAHAYA =====
void checkAlertStatus(float temperature, int humidity) {
  bool tempAlert = temperature < TEMP_LOW || temperature > TEMP_HIGH;
  bool humAlert = humidity < HUM_LOW || humidity > HUM_HIGH;

  if (tempAlert || humAlert) {
    if (!isAlerting) {
      isAlerting = true;
      Serial.printf("🚨 Alert: sensor tidak normal (temp=%.1f, hum=%d)\n", temperature, humidity);
    }
  } else {
    if (isAlerting) {
      isAlerting = false;
      noTone(BUZZER_PIN); // Matikan sirine sepenuhnya jika kondisi aman
      digitalWrite(BUZZER_PIN, LOW);
      Serial.println("✅ Kondisi Normal. Sirine Dimatikan.");
    }
  }
}

// ===== FUNGSI PENGHASIL SUARA SIRINE RELEVAN (NON-BLOCKING) =====
void handleSirine() {
  if (isAlerting) {
    unsigned long currentMillis = millis();
    
    // Melakukan update frekuensi nada setiap 4 milidetik
    if (currentMillis - lastSirineUpdate >= SIRINE_INTERVAL) {
      lastSirineUpdate = currentMillis;
      
      // Menaikkan dan menurunkan frekuensi secara bertahap
      if (frequencyRising) {
        sirineFrequency += 4;         // Kehalusan kenaikan nada
        if (sirineFrequency >= 1200) { // Nada tertinggi sirine (1200 Hz)
          frequencyRising = false;
        }
      } else {
        sirineFrequency -= 4;         // Kehalusan penurunan nada
        if (sirineFrequency <= 500) {  // Nada terendah sirine (500 Hz)
          frequencyRising = true;
        }
      }
      
      // Bunyikan piezo/buzzer sesuai frekuensi yang dikalkulasi
      tone(BUZZER_PIN, sirineFrequency);
    }
  }
}