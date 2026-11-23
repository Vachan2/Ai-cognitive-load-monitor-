#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>

// ---------------- Wi-Fi Configuration ----------------

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ---------------- LED Configuration ----------------

#define LED_PIN D4
#define LED_COUNT 12

// Keep brightness low when powered through Mac USB
#define LED_BRIGHTNESS 20

Adafruit_NeoPixel ring(
  LED_COUNT,
  LED_PIN,
  NEO_GRB + NEO_KHZ800
);

// ---------------- HTTP Server ----------------

ESP8266WebServer server(80);

// ---------------- LED Control ----------------

void setRingColor(int r, int g, int b) {
  r = constrain(r, 0, 255);
  g = constrain(g, 0, 255);
  b = constrain(b, 0, 255);

  ring.fill(ring.Color(r, g, b));
  ring.show();
}

void turnOffRing() {
  ring.clear();
  ring.show();
}

// ---------------- Cognitive Load Endpoint ----------------

void handleLoad() {

  if (!server.hasArg("plain")) {
    server.send(400, "application/json",
                "{\"error\":\"Missing JSON body\"}");
    return;
  }

  JsonDocument doc;

  DeserializationError error =
      deserializeJson(doc, server.arg("plain"));

  if (error) {
    server.send(400, "application/json",
                "{\"error\":\"Invalid JSON\"}");
    return;
  }

  int load = doc["load"] | 0;

  int r = doc["r"] | 0;
  int g = doc["g"] | 0;
  int b = doc["b"] | 0;

  load = constrain(load, 0, 100);

  setRingColor(r, g, b);

  Serial.printf(
    "Cognitive Load: %d | RGB: %d, %d, %d\n",
    load, r, g, b
  );

  server.send(200, "application/json",
              "{\"status\":\"ok\"}");
}

// ---------------- Stop Session Endpoint ----------------

void handleOff() {

  turnOffRing();

  Serial.println("Session stopped. LED ring turned OFF.");

  server.send(200, "application/json",
              "{\"status\":\"off\"}");
}

// ---------------- Health Check ----------------

void handleHealth() {

  server.send(200, "application/json",
              "{\"status\":\"online\",\"device\":\"ESP8266\"}");
}

// ---------------- Setup ----------------

void setup() {

  Serial.begin(115200);

  ring.begin();
  ring.setBrightness(LED_BRIGHTNESS);
  turnOffRing();

  Serial.println();
  Serial.println("Starting AI Cognitive Load Monitor...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi Connected!");

  Serial.print("ESP8266 IP Address: ");
  Serial.println(WiFi.localIP());

  // Register HTTP endpoints
  server.on("/load", HTTP_POST, handleLoad);
  server.on("/off", HTTP_POST, handleOff);
  server.on("/health", HTTP_GET, handleHealth);

  server.begin();

  Serial.println("HTTP Server Started!");
  Serial.println("Ready to receive cognitive load data.");
}

// ---------------- Main Loop ----------------

void loop() {

  server.handleClient();

  // Reconnect if Wi-Fi disconnects
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }
}
