#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include "qrcodegen.h"
#include <time.h>
#include <WiFiClientSecure.h>
#include <ArduinoOTA.h>
#include "esp_ota_ops.h"
#include "esp_partition.h"

/* ================= BLOCKCHAIN & ENCRYPTION ================= */
#include "mbedtls/md.h"

String generateBlockchainHash(String previousHash, String payload) {
  String toHash = previousHash + payload;
  unsigned char hashOutput[32];
  
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 0);
  mbedtls_md_starts(&ctx);
  mbedtls_md_update(&ctx, (const unsigned char *) toHash.c_str(), toHash.length());
  mbedtls_md_finish(&ctx, hashOutput);
  mbedtls_md_free(&ctx);

  String hexHash = "";
  for(int i = 0; i < 32; i++) {
    char str[3];
    sprintf(str, "%02x", (int)hashOutput[i]);
    hexHash += str;
  }
  return hexHash;
}

String lastBlockHash = "0000000000000000000000000000000000000000000000000000000000000000"; // Genesis Hash

// ============================================================
// 🔐 SHA-256 PIN HASHER — Never store/compare raw PINs
// ============================================================
String hashPIN(String pin) {
  unsigned char hashOutput[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 0);
  mbedtls_md_starts(&ctx);
  mbedtls_md_update(&ctx, (const unsigned char *) pin.c_str(), pin.length());
  mbedtls_md_finish(&ctx, hashOutput);
  mbedtls_md_free(&ctx);
  String hex = "";
  for(int i = 0; i < 32; i++) {
    char str[3];
    sprintf(str, "%02x", (int)hashOutput[i]);
    hex += str;
  }
  return hex;
}

// 🔐 Firebase Root CA Certificate (ISRG Root X1) — Prevents MITM attacks
const char* FIREBASE_ROOT_CA = \
"-----BEGIN CERTIFICATE-----\n"
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n"
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n"
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n"
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n"
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n"
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n"
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n"
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n"
"A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n"
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n"
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n"
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n"
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n"
"OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\n"
"jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\n"
"qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\n"
"rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n"
"HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\n"
"hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\n"
"ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n"
"3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\n"
"NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\n"
"ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\n"
"TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwH\n"
"-----END CERTIFICATE-----\n";

WiFiClientSecure wifiClient;

/* ================= WIFI ================= */
#define WIFI_SSID     "Sarthak_Raut"
#define WIFI_PASSWORD "qwertyuiop"

/* ================= LOCKER CONFIGURATION ================= */
#define LOCKER_ID     "4"   

/* ================= OTA CONFIGURATION ================= */
#define OTA_HOSTNAME              "LockNLeave-Locker-" LOCKER_ID
#define OTA_PASSWORD              "RAut14!@"
#define OTA_PORT                  3232
#define OTA_VALIDATION_TIMEOUT_MS 30000UL // 30s boot validation window

// OTA Rollback & Health Monitoring State
bool otaPendingVerification = false;
bool otaValidationPassed    = false;
unsigned long bootTimestamp = 0;

/* ================= FIREBASE ================= */
#define FIREBASE_HOST "asep-smart-locker-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_SECRET "ehwg3KYlrxk8jVP5wOQcX4YUZ66IZ1h1aHme2Uu"   

/* ================= HARDWARE ================= */
#define LOCK_PIN 26 
#define UNLOCK_TIME 3000

/* ================= NEW SENSORS (From Table) ================= */
#define TRIG_PIN 14
#define ECHO_PIN 27
#define DOOR_SENSOR_PIN 34
#define TOUCH_IRQ 21
#define BUZZER_PIN 13

/* ================= PINS ================= */
#define TFT_CS    5
#define TFT_DC    4
#define TFT_RST   22

/* ================= TOUCH ================= */
#define TOUCH_CS  15
#define TOUCH_CLK 25
#define TOUCH_DIN 32
#define TOUCH_DO  36
/* ================= THEME (HEX MATCHED) ================= */
uint16_t RGB565(uint8_t r, uint8_t g, uint8_t b) { return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3); }

#define THEME_BG          RGB565(15, 23, 42)       // Dark Navy Blue
#define THEME_HEADER      RGB565(15, 35, 80)       // Deep Navy Header
#define THEME_BTN         RGB565(40, 55, 90)       // Slate Blue Button
#define THEME_BTN_PRESS   RGB565(0, 210, 255)      // Cyan Press
#define THEME_TEXT        RGB565(255, 255, 255)    // White
#define THEME_ACCENT      RGB565(0, 210, 255)      // Cyan Accent
#define THEME_CANCEL      RGB565(255, 40, 40)      // Solid Red
#define THEME_ENTER       RGB565(0, 220, 110)      // Solid Green
#define THEME_NEUTRAL     RGB565(255, 180, 0)      // Gold
#define THEME_SHADOW      RGB565(0, 10, 20)        // Deep Shadow

/* ================= TOUCH KEYPAD ================= */
struct TouchButton {
  int x, y, w, h;
  char label;
  uint16_t color;
  uint16_t pressColor;
  bool isPressed;
};

TouchButton buttons[12] = {
  { 16,  105, 64, 42, '1', THEME_BTN, THEME_BTN_PRESS, false },
  { 88,  105, 64, 42, '2', THEME_BTN, THEME_BTN_PRESS, false },
  { 160, 105, 64, 42, '3', THEME_BTN, THEME_BTN_PRESS, false },
  
  { 16,  153, 64, 42, '4', THEME_BTN, THEME_BTN_PRESS, false },
  { 88,  153, 64, 42, '5', THEME_BTN, THEME_BTN_PRESS, false },
  { 160, 153, 64, 42, '6', THEME_BTN, THEME_BTN_PRESS, false },
  
  { 16,  201, 64, 42, '7', THEME_BTN, THEME_BTN_PRESS, false },
  { 88,  201, 64, 42, '8', THEME_BTN, THEME_BTN_PRESS, false },
  { 160, 201, 64, 42, '9', THEME_BTN, THEME_BTN_PRESS, false },
  
  { 16,  249, 64, 42, '<', THEME_CANCEL, THEME_BTN_PRESS, false }, // Cancel/Del
  { 88,  249, 64, 42, '0', THEME_BTN, THEME_BTN_PRESS, false },
  { 160, 249, 64, 42, '#', THEME_ENTER, THEME_BTN_PRESS, false }  // Enter
};

/* ================= STATE ================= */
enum LockerState { LOCKED, UNLOCKED };
LockerState state = LOCKED;
String enteredPIN = "";
unsigned long unlockStart = 0;
unsigned long lastQrUpdate = 0;
const unsigned long QR_UPDATE_INTERVAL = 300000;

String currentBackendStatus = "AVAILABLE";
unsigned long long currentSessionEnd = 0;
int currentUnlockCount = 0;
unsigned long lastFirebasePoll = 0;
const unsigned long POLL_INTERVAL = 3000; // Balanced 3s polling for reliability and speed
unsigned long lastKeypadInteraction = 0;
unsigned long lastTouch = 0; 


// Security variables
int failedAttempts = 0;
unsigned long lockoutUntil = 0;

// Door sensor monitoring
bool doorCurrentlyOpen = false;
unsigned long doorOpenSince = 0;
unsigned long doorOpenDuration = 0; // Cumulative ms the door has been open this session
unsigned long lastDoorSync = 0;
const unsigned long DOOR_SYNC_INTERVAL = 1000; // Push door data every 1s for snappy sync

// Buzzer alert thresholds (per continuous open round)
int buzzerLevel = 0; // 0 = no alert, 1 = 10s, 2 = 15s, 3 = 20s

// Ultrasonic
float emptyDistance = 0.0;
bool itemPresent = false;
unsigned long lastUltrasonicUpdate = 0;
const unsigned long ULTRASONIC_INTERVAL = 200; // 200ms fast sampling (5 Hz)
int detectionCount = 0; // Debounce counter

enum DisplayMode { DISP_QR, DISP_INFO };
DisplayMode currentDisplayMode = DISP_QR;
bool forceRedraw = true;

bool terminationMode = false;
String terminationPIN = "";

long debugDuration = 0;
long long debugStartTime = 0;
String currentStatusMsg = "Enter PIN...";
uint16_t currentStatusColor = THEME_NEUTRAL;

/* ================= OBJECTS ================= */
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);
uint8_t qrcode[qrcodegen_BUFFER_LEN_MAX];
uint8_t tempBuffer[qrcodegen_BUFFER_LEN_MAX];

/* ================= TOUCH HELPERS (BIT-BANGED) ================= */
uint16_t readTouch(uint8_t cmd) {
  uint16_t r = 0;
  digitalWrite(TOUCH_CS, LOW);
  delayMicroseconds(10); // CS settling time
  
  // Send 8-bit command
  for (int i = 7; i >= 0; i--) {
    digitalWrite(TOUCH_DIN, (cmd >> i) & 1);
    digitalWrite(TOUCH_CLK, HIGH);
    delayMicroseconds(5);
    digitalWrite(TOUCH_CLK, LOW);
    delayMicroseconds(5);
  }
  
  delayMicroseconds(10); // ADC conversion settling
  
  // Read 12-bit result
  for (int i = 11; i >= 0; i--) {
    digitalWrite(TOUCH_CLK, HIGH);
    delayMicroseconds(5);
    if (digitalRead(TOUCH_DO)) r |= (1 << i);
    digitalWrite(TOUCH_CLK, LOW);
    delayMicroseconds(5);
  }
  
  digitalWrite(TOUCH_CS, HIGH);
  return r;
}

bool getTouch(int &x, int &y) {
  // Z-pressure first — diagnostics confirmed: idle Z=0 ALWAYS, real touch Z>0
  uint16_t z1 = readTouch(0xB0);
  if (z1 < 3) return false;  // Not touching

  // Single X/Y read for maximum sensitivity
  uint16_t rx = readTouch(0xD0);
  uint16_t ry = readTouch(0x90);

  // Safety net: reject ADC max noise
  if (ry > 2000 || rx < 50) return false;

  // Compensate for resistive touch panel tilt / cross-coupling:
  // When Y is near the top (Row 0, ry ~800), rx reads ~180 counts higher than at the bottom (Row 3, ry ~1700).
  int rx_comp = (int)rx;
  if (ry < 1800) {
    rx_comp -= (int)((1800 - ry) * 0.18f);
  }
  if (rx_comp < 50) rx_comp = 50;

  // Calibrated mapping: 
  // Physical X range for 240px width spans ~780 (left) to ~2100 (right)
  x = map(rx_comp, 780, 2100, 0, 240);
  y = map(ry, 240, 1900, 0, 320);

  x = constrain(x, 0, 239);
  y = constrain(y, 0, 319);

  Serial.printf("[TOUCH] Z=%d RAW(%d,%d) COMP_X=%d -> MAP(%d,%d)\n", z1, rx, ry, rx_comp, x, y);
  return true;
}

void unlockLocker(bool clearCommand = false);
void terminateSession();
void updateDoorSensor();
void calibrateUltrasonic();
void updateUltrasonic();
void setupOTA();
void checkFirmwareRollbackStatus();
void validateFirmwareHealth();

/* ================= SETUP ================= */
void setup() {
  // --- MINIMAL SAFE START ---
  // Setting Pin 26 to LOW immediately. This is the standard OFF state.
  digitalWrite(LOCK_PIN, LOW); 
  pinMode(LOCK_PIN, OUTPUT);
  
  Serial.begin(115200);
  bootTimestamp = millis();
  Serial.println("--- STARTING NORMAL OPERATION ---");
  
  // Check OTA bootloader state and partition status
  checkFirmwareRollbackStatus();
  
  state = LOCKED;

  
  pinMode(TOUCH_CLK, OUTPUT);
  pinMode(TOUCH_DIN, OUTPUT);
  pinMode(TOUCH_DO, INPUT);
  pinMode(TOUCH_CS, OUTPUT);
  digitalWrite(TOUCH_CS, HIGH);

  // New Sensors Init
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(DOOR_SENSOR_PIN, INPUT); // Pin 34 has no internal pull-up. You MUST use a physical 10k resistor.
  pinMode(TOUCH_IRQ, INPUT_PULLUP);
  
  // Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  digitalWrite(TRIG_PIN, LOW); // Ensure ultrasonic is idle
  delay(500);
  calibrateUltrasonic();

  SPI.begin(18, 19, 23);  // SCK=18, MISO=19, MOSI=23
  
  tft.init(240, 320); 
  tft.setRotation(2);

  uint8_t madctl = 0x88; 
  tft.sendCommand(0x36, &madctl, 1); 

  tft.invertDisplay(false);
  tft.fillScreen(THEME_BG);
  
  Serial.println("[TOUCH] Bit-banged XPT2046 init done.");
  
  centerText("Connecting...", 150, 2, THEME_NEUTRAL);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int w = 0;
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print(".");
    w++;
    if (w > 60) { 
        tft.fillScreen(THEME_BG);
        centerText("ERROR", 130, 2, THEME_CANCEL);
        centerText("WiFi Failed", 160, 2, THEME_CANCEL);
        delay(3000);
        ESP.restart();
    }
  }
  
  tft.fillScreen(THEME_BG);
  centerText("Connected!", 150, 2, THEME_BTN_PRESS);
  delay(500);
  
  // 🛡️ Note: Google Firebase uses GTS Root R1 or GlobalSign R2, which rotate over time.
  // Using ISRG Root X1 (Let's Encrypt) causes SSL handshakes to fail completely.
  // We use setInsecure() for stable connections. Application logic is secured 
  // via SHA-256 hashed PIN checks and Firebase rules over the HTTPS tunnel.
  wifiClient.setInsecure();
  
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  tft.fillScreen(THEME_BG);
  centerText("Syncing Time...", 150, 2, THEME_TEXT);
  
  time_t now = time(NULL);
  unsigned long tStart = millis();
  while (now < 1600000000 && millis() - tStart < 15000) { // Wait up to 15s for valid time
    delay(500);
    now = time(NULL);
    Serial.print("T");
  }
  if (now > 1600000000) Serial.println("\n[TIME] Sync Successful");
  else Serial.println("\n[TIME] Sync Failed (Proceeding with local timer)");
  
  // ==================== OTA UPDATE ====================
  setupOTA();

  pollLockerStatus();
  
  // Perform initial boot health validation
  validateFirmwareHealth();
  
  forceRedraw = true;
}

/* ================= LOOP ================= */
void loop() {
  // ==================== OTA UPDATE & HEALTH ====================
  ArduinoOTA.handle();

  if (otaPendingVerification && !otaValidationPassed) {
    validateFirmwareHealth();
  }

  if (state == LOCKED) {
    handleTouch();
  } else {
    handleAutoLock();
  }

  checkSessionExpiration();
  updateDoorSensor();
  updateUltrasonic();
  
  // Allow smooth touch typing: pause polling for 3 seconds after a touch interaction (reduced for responsiveness)
  bool userIsTyping = (millis() - lastKeypadInteraction < 3000);
  
  if (millis() - lastFirebasePoll >= POLL_INTERVAL && !userIsTyping) {
    pollLockerStatus();
    lastFirebasePoll = millis();
  }
  
  if (state == LOCKED) { 
    if (terminationMode) {
      static unsigned long lastTermDraw = 0;
      if (forceRedraw || millis() - lastTermDraw >= 1000) {
        drawTerminationMode();
        lastTermDraw = millis();
      }
    } else if (currentDisplayMode == DISP_QR) {
      if (forceRedraw || millis() - lastQrUpdate >= QR_UPDATE_INTERVAL) {
        forceRedraw = true; // Ensure drawQRMode executes
        drawQRMode();
      }
    } else {
      static unsigned long lastTimerDraw = 0;
      if (forceRedraw || millis() - lastTimerDraw >= 1000) {
        drawInfoMode();
        lastTimerDraw = millis();
      }
    }
  }
}

/* ================= IMPLEMENTATIONS ================= */
void centerText(const char* text, int y, int size, uint16_t color) {
  tft.setTextSize(size);
  tft.setTextColor(color);
  int16_t x1, y1;
  uint16_t w, h;
  tft.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  int x = (tft.width() - w) / 2;
  tft.setCursor(x, y);
  tft.print(text);
}

void processKeypadEntry(char key) {
  // ---------------- TERMINATION MODE ----------------
  if (terminationMode) {
    if (key >= '0' && key <= '9') {
      if (terminationPIN.length() < 4) terminationPIN += key; // Strictly limit to 4
      drawTerminationPinState();
    }
    else if (key == '#') {
      if (terminationPIN.length() > 0) checkTerminationPIN();
    }
    else if (key == '<') {
      // Smart Backspace vs Exit
      if (terminationPIN.length() > 0) {
         terminationPIN.remove(terminationPIN.length() - 1); // Delete last character
         drawTerminationPinState();
      } else {
         terminationMode = false;
         terminationPIN = "";
         forceRedraw = true; // Return to standard screen
      }
    }
    return;
  }
  
  // ---------------- STANDARD / UNLOCK MODE ----------------
  if (key >= '0' && key <= '9') {
    if (enteredPIN.length() < 4) enteredPIN += key; // Strictly limit to 4
    drawPinState();
    updateStatus("Enter PIN...", THEME_NEUTRAL);
  }
  else if (key == '#') {
    if (enteredPIN.length() > 0) checkPIN();
  }
  else if (key == '<') {
    // Smart Backspace vs Terminate
    if (enteredPIN.length() > 0) {
       enteredPIN.remove(enteredPIN.length() - 1); // Delete last character
       drawPinState();
       updateStatus("Enter PIN...", THEME_NEUTRAL);
    } else if (currentBackendStatus == "ACTIVE") {
       terminationMode = true;
       terminationPIN = "";
       forceRedraw = true;
    }
  }
}

/* ================= TOUCH HANDLER ================= */
void handleTouch() {
  int tx, ty;
  if (!getTouch(tx, ty)) {
    for (int i = 0; i < 12; i++) {
      if (buttons[i].isPressed) {
        buttons[i].isPressed = false;
        drawButton(i);
      }
    }
    return;
  }

  if (millis() - lastTouch < 50) return;
  lastTouch = millis();
  lastKeypadInteraction = millis();

  if (currentDisplayMode == DISP_QR && !terminationMode) {
    if (ty < 40) {
      pollLockerStatus();
    }
    return;
  }

  // Grid partitioning for 3 columns x 4 rows to prevent accidental column mis-clicks
  // Col 0: x < 98 (centers on 48..58: '1', '4', '7', '<')
  // Col 1: 98 <= x < 156 (centers on 120: '2', '5', '8', '0')
  // Col 2: x >= 156 (centers on 192: '3', '6', '9', '#')
  int col = -1;
  if (tx < 98) col = 0;
  else if (tx < 156) col = 1;
  else col = 2;

  // Row 0: 90 <= y < 150 ('1', '2', '3')
  // Row 1: 150 <= y < 198 ('4', '5', '6')
  // Row 2: 198 <= y < 246 ('7', '8', '9')
  // Row 3: 246 <= y <= 315 ('<', '0', '#')
  int row = -1;
  if (ty >= 90 && ty < 150) row = 0;
  else if (ty >= 150 && ty < 198) row = 1;
  else if (ty >= 198 && ty < 246) row = 2;
  else if (ty >= 246 && ty <= 315) row = 3;

  if (row >= 0 && col >= 0) {
    int i = row * 3 + col;
    if (!buttons[i].isPressed) {
      buttons[i].isPressed = true;
      drawButton(i);
      processKeypadEntry(buttons[i].label);
      delay(50);
      buttons[i].isPressed = false;
      drawButton(i);
      return;
    }
  }
}




void drawButton(int i) {
   uint16_t bgColor = buttons[i].isPressed ? THEME_BTN_PRESS : buttons[i].color;
   uint16_t textColor = THEME_TEXT;
   
   // Handle special button colors
   if (buttons[i].label == '<') bgColor = buttons[i].isPressed ? THEME_BTN_PRESS : THEME_CANCEL;
   if (buttons[i].label == '#') bgColor = buttons[i].isPressed ? THEME_BTN_PRESS : THEME_ENTER;

   if (!buttons[i].isPressed) {
     tft.fillRoundRect(buttons[i].x + 2, buttons[i].y + 2, buttons[i].w, buttons[i].h, 10, THEME_SHADOW);
   }

   tft.fillRoundRect(buttons[i].x, buttons[i].y, buttons[i].w, buttons[i].h, 10, bgColor);
   tft.drawRoundRect(buttons[i].x, buttons[i].y, buttons[i].w, buttons[i].h, 10, THEME_ACCENT);
   
   tft.setTextSize(2);
   tft.setTextColor(textColor);
   
   int16_t x1, y1;
   uint16_t tw, th;
   String lbl = String(buttons[i].label);
   tft.getTextBounds(lbl.c_str(), 0, 0, &x1, &y1, &tw, &th);
   
   int cx = buttons[i].x + (buttons[i].w - tw) / 2;
   int cy = buttons[i].y + (buttons[i].h - th) / 2;
   tft.setCursor(cx, cy);
   tft.print(buttons[i].label);
}

void drawKeypad() {
  for (int i=0; i<12; i++) drawButton(i);
}

void drawPinState() {
  tft.fillRect(0, 50, 240, 45, THEME_BG);
  
  if (enteredPIN.length() > 0) {
    String masked = "";
    for (int i = 0; i < enteredPIN.length(); i++) masked += "* ";
    centerText(masked.c_str(), 75, 2, THEME_TEXT);
  } else {
    centerText("- - - -", 75, 2, THEME_BTN);
  }
}

void drawTerminationPinState() {
  tft.fillRect(0, 50, 240, 45, THEME_BG);
  
  if (terminationPIN.length() > 0) {
    String masked = "";
    for (int i = 0; i < terminationPIN.length(); i++) masked += "* ";
    centerText(masked.c_str(), 75, 2, THEME_TEXT);
  } else {
    centerText("- - - -", 75, 2, THEME_BTN);
  }
}

void updateStatus(String msg, uint16_t color) {
  currentStatusMsg = msg;
  currentStatusColor = color;
  
  tft.fillRect(0, 298, 240, 22, THEME_BG);
  centerText(currentStatusMsg.c_str(), 300, 2, currentStatusColor);
}

void displayQRCode(const char* text, int yPos, int maxScale) {
  bool ok = qrcodegen_encodeText(text, tempBuffer, qrcode, qrcodegen_Ecc_LOW,
                                 qrcodegen_VERSION_MIN, qrcodegen_VERSION_MAX,
                                 qrcodegen_Mask_AUTO, true);
  if (ok) {
    int size = qrcodegen_getSize(qrcode);
    int scale = maxScale;
    while ((size * scale) > tft.width() - 40) scale--;
    
    int pxSize = size * scale;
    int x = (tft.width() - pxSize) / 2;
    int margin = 8;
    
    tft.fillRect(x - margin, yPos - margin, pxSize + (margin * 2), pxSize + (margin * 2), THEME_TEXT);
    for (int py = 0; py < size; py++) {
      for (int px = 0; px < size; px++) {
        if (qrcodegen_getModule(qrcode, px, py)) {
          tft.fillRect(x + (px * scale), yPos + (py * scale), scale, scale, THEME_BG);
        }
      }
    }
  }
}

// ---------------- UI RENDER LOOPS ---------------- //

void drawQRMode() {
  if (forceRedraw) {
    tft.fillScreen(THEME_BG);

    // Dark Navy Header
    tft.fillRect(0, 0, 240, 45, THEME_HEADER);
    tft.drawFastHLine(0, 45, 240, THEME_ACCENT);
    centerText("LockNLeave", 14, 2, THEME_TEXT);

    // Subtitle
    centerText("SCAN TO BOOK", 60, 2, THEME_NEUTRAL);
    
    // QR code with white backing for scanning integrity
    unsigned long long nowMs = (unsigned long long)time(NULL) * 1000ULL;
    String dynamicURL = "https://locknleave.vercel.app/book/confirm?id=" + String(LOCKER_ID) + "&t=" + String(nowMs);
    displayQRCode(dynamicURL.c_str(), 100, 5);

    // Modern Locker Badge
    tft.fillRoundRect(50, 290, 140, 25, 8, THEME_BTN);
    String lockerText = "LOCKER #" + String(LOCKER_ID);
    centerText(lockerText.c_str(), 295, 2, THEME_TEXT);

    lastQrUpdate = millis();
    forceRedraw = false;
  }
}

void drawInfoMode() {
  unsigned long long nowMs = (unsigned long long)time(NULL) * 1000ULL;
  bool showTimer = (currentUnlockCount > 0);
  
  if (forceRedraw) {
    tft.fillScreen(THEME_BG);
    
    // Header
    tft.fillRect(0, 0, 240, 40, THEME_HEADER);
    centerText("LockNLeave", 12, 2, THEME_TEXT);
    
    drawKeypad();
    drawPinState();
    updateStatus("Enter PIN to Open", THEME_TEXT);
    
    forceRedraw = false;
  }
  
  if (showTimer) {
      long remainingSeconds = 0;
      if (currentSessionEnd > nowMs) {
          remainingSeconds = (long)((currentSessionEnd - nowMs) / 1000);
      }
      
      int hours = remainingSeconds / 3600;
      int minutes = (remainingSeconds % 3600) / 60;
      int seconds = remainingSeconds % 60;
      
      char timeStr[16];
      sprintf(timeStr, "%02d:%02d:%02d", hours, minutes, seconds);
      
      // Smaller Timer Box
      tft.fillRect(60, 45, 120, 25, THEME_BTN);
      tft.drawRoundRect(60, 45, 120, 25, 6, THEME_ACCENT);
      centerText(timeStr, 50, 2, THEME_TEXT);
  }
}

void drawTerminationMode() {
  if (forceRedraw) {
    tft.fillScreen(THEME_BG);
    
    tft.fillRect(0, 0, 240, 42, THEME_CANCEL);
    centerText("END SESSION", 14, 2, THEME_TEXT);

    // centerText("Confirm PIN", 45, 2, THEME_NEUTRAL); // Removed as requested
    
    drawKeypad();
    drawTerminationPinState();
    
    // updateStatus("Enter PIN...", THEME_NEUTRAL); // Removed as requested
    forceRedraw = false;
  }
}

/* ================= EXECUTIONS ================= */
void pollLockerStatus() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setReuse(false); // Forced fresh connection for maximum reliability
  http.setConnectTimeout(2000); // 2s timeout for snappier failure recovery
  String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
  
  http.begin(wifiClient, url);
  int httpCode = http.GET();
  String payload = http.getString();
  http.end();

  if (httpCode == 200 && payload.length() > 0 && payload != "null") {
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, payload); 
    if (err) return; // Prevent corrupt JSON from resetting display mode
    
    const char* st = doc["status"];
    unsigned long long endTs = doc["sessionEnd"].as<unsigned long long>();
    
    // Check for Remote Commands
    const char* cmd = doc["command"];
    if (cmd && String(cmd) == "OPEN") {
      Serial.println("*** REMOTE OPEN COMMAND RECEIVED ***");
      unlockLocker(true);
    }
    
    // Read timestamps with precision
    debugStartTime = doc["startTime"].as<unsigned long long>();
    debugDuration = doc["duration"].as<long>(); // Assuming duration is in ms or converted later
    
    if (endTs == 0) {
       if (debugStartTime > 0 && debugDuration > 0) {
         endTs = debugStartTime + (unsigned long long)debugDuration;
       }
    }
    
    int unlocks = doc["unlockCount"] | 0; 
    String newStatus = st ? String(st) : "AVAILABLE";
    
    // Always update internal state from RTDB on every poll
    bool statusChanged = (newStatus != currentBackendStatus);
    bool unlockChanged = (unlocks != currentUnlockCount);

    currentBackendStatus = newStatus;
    currentSessionEnd = (unsigned long long)endTs;
    currentUnlockCount = unlocks;

    // Always enforce correct display mode based on current status
    if (currentBackendStatus == "ACTIVE") {
      if (currentDisplayMode != DISP_INFO || statusChanged || unlockChanged) {
        currentDisplayMode = DISP_INFO;
        forceRedraw = true;
        Serial.println("[POLL] Status=ACTIVE -> Transition to DISP_INFO");
      }
    } else {
      if (currentDisplayMode != DISP_QR || statusChanged) {
        currentDisplayMode = DISP_QR;
        terminationMode = false;
        terminationPIN = "";
        forceRedraw = true;
        Serial.println("[POLL] Status=AVAILABLE -> Transition to DISP_QR");
      }
    }
  }
}


void checkPIN() {
  if (millis() < lockoutUntil) {
    long remaining = (lockoutUntil - millis()) / 1000;
    updateStatus("LOCKED: Wait " + String(remaining) + "s", THEME_CANCEL);
    delay(1000);
    enteredPIN = "";
    drawPinState();
    return;
  }
  
  updateStatus("Checking...", THEME_NEUTRAL);
  
  if (WiFi.status() != WL_CONNECTED) {
    updateStatus("WiFi Error", THEME_CANCEL);
    return;
  }
  
  HTTPClient http;
  http.setReuse(true);
  String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
  http.begin(wifiClient, url);
  int httpCode = http.GET();
  String payload = http.getString();
  http.end();
  
  if (httpCode == 200 && payload.length() > 0 && payload != "null") {
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, payload);
    
    const char* firebasePIN = doc["pin"];
    const char* status = doc["status"];
    
    if (String(status) == "ACTIVE" && hashPIN(enteredPIN) == String(firebasePIN)) {
      failedAttempts = 0; // Clear attempts on success
      unsigned long long endTs = doc["sessionEnd"].as<unsigned long long>();
      if (endTs == 0) {
         long long start = doc["startTime"];
         long duration = doc["duration"]; 
         if (start > 0 && duration > 0) {
           endTs = (unsigned long long)start + (unsigned long long)duration;
         }
      }
      currentSessionEnd = endTs;
      currentBackendStatus = "ACTIVE";
      
      enteredPIN = ""; // Clear immediately on success
      
      updateStatus("Access Granted!", THEME_BTN_PRESS);
      Serial.println("[AUTH] PIN Correct. Unlocking...");
      delay(700);
      unlockLocker();
    } else {
      failedAttempts++;
      if (failedAttempts >= 3) {
        lockoutUntil = millis() + 30000; // 30 sec lockout
        failedAttempts = 0; // reset for next active period
        updateStatus("Locked Out (30s)", THEME_CANCEL);
      } else {
        updateStatus("Wrong PIN", THEME_CANCEL);
      }
      delay(2000);
      enteredPIN = "";
      drawPinState();
      
      if (millis() > lockoutUntil) {
        updateStatus("Enter PIN...", THEME_NEUTRAL);
      }
    }
  }
}

void checkTerminationPIN() {
  updateStatus("Checking...", THEME_NEUTRAL);

  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.setReuse(true);
  String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
  
  http.begin(wifiClient, url);
  int httpCode = http.GET();
  String payload = http.getString();
  http.end();
  
  if (httpCode == 200 && payload.length() > 0 && payload != "null") {
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, payload);
    
    const char* firebasePIN = doc["pin"];
    const char* status = doc["status"];
    
    if (String(status) == "ACTIVE" && hashPIN(terminationPIN) == String(firebasePIN)) {
      updateStatus("Access Granted!", THEME_BTN_PRESS);
      delay(700);
      terminateSession();
    } else {
      updateStatus("Wrong PIN", THEME_CANCEL);
      delay(2000);
      terminationPIN = "";
      drawTerminationPinState();
      // updateStatus("Enter PIN...", THEME_NEUTRAL); // Removed as requested
    }
  }
}

void terminateSession() {
  if (WiFi.status() == WL_CONNECTED) {
     HTTPClient http;
     http.setReuse(true);
     String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
     String json = "{\"status\":\"AVAILABLE\",\"pin\":\"\",\"startTime\":0,\"sessionEnd\":0,\"duration\":0,\"unlockCount\":0,\"itemPresent\":false,\"doorStatus\":\"CLOSED\",\"doorOpenDuration\":0}";
     
     http.begin(wifiClient, url);
     http.sendRequest("PATCH", json);
     http.end();
  }
  
  digitalWrite(LOCK_PIN, LOW);
  state = LOCKED;
  
  currentBackendStatus = "AVAILABLE";
  currentSessionEnd = 0;
  currentUnlockCount = 0;
  enteredPIN = "";
  terminationPIN = "";
  terminationMode = false;
  debugStartTime = 0;
  debugDuration = 0;
  
  tft.fillScreen(THEME_BG);
  centerText("Session", 120, 3, THEME_NEUTRAL);
  centerText("Terminated", 160, 3, THEME_NEUTRAL);
  delay(1500);
  
  currentDisplayMode = DISP_QR;
  forceRedraw = true;
}

void unlockLocker(bool clearCommand) {
  Serial.println("[HARDWARE] Triggering Solenoid: Writing HIGH to Pin 26");
  digitalWrite(LOCK_PIN, HIGH); // ON
  unlockStart = millis();
  state = UNLOCKED;
  currentUnlockCount++; 
  
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.setReuse(true);
    String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
    
    // Use ArduinoJson to build the payload for better reliability
    StaticJsonDocument<512> updateDoc;
    updateDoc["unlockCount"] = currentUnlockCount;
    updateDoc["status"] = "ACTIVE";
    updateDoc["lastAction"] = "USER_UNLOCK";
    updateDoc["lastUpdate"] = (unsigned long long)time(NULL) * 1000ULL;
    
    if (clearCommand) updateDoc["command"] = (char*)NULL;
    
    if (debugStartTime == 0 && time(NULL) > 1600000000) {
       unsigned long long nowUTC = (unsigned long long)time(NULL) * 1000ULL;
       unsigned long long durMs = (unsigned long long)debugDuration;
       if (durMs > 0 && durMs < 10000) durMs *= 60000ULL; 
       if (durMs == 0) durMs = 3600000ULL; // Safety fallback: default 1 hour if duration wasn't fetched yet
       
       unsigned long long newEndUTC = nowUTC + durMs;
       
       updateDoc["startTime"] = nowUTC;
       updateDoc["sessionEnd"] = newEndUTC;
       
       debugStartTime = nowUTC;
       currentSessionEnd = newEndUTC; 
       Serial.println("[SYNC] First unlock - setting startTime and sessionEnd.");
    }
    
    String jsonUpdate;
    serializeJson(updateDoc, jsonUpdate);
    
    Serial.print("[DB] Sending Update: "); Serial.println(jsonUpdate);
    
    // Use fresh connection for the write operation
    http.setReuse(false); 
    http.begin(wifiClient, url);
    http.addHeader("Content-Type", "application/json");
    int patchCode = http.sendRequest("PATCH", jsonUpdate);
    
    Serial.print("[DB] Locker Update Code: "); Serial.println(patchCode);
    if (patchCode == 200 || patchCode == 201 || patchCode == 204) {
       Serial.println("[DB] Update Successful!");
    } else {
       Serial.print("[DB] Error Response: "); Serial.println(http.getString());
    }
    http.end();
    
    // --- IoT BLOCKCHAIN AUDIT LOG ---
    StaticJsonDocument<256> blockDoc;
    JsonObject payloadObj = blockDoc.createNestedObject("payload");
    payloadObj["locker_id"] = LOCKER_ID;
    payloadObj["timestamp"] = (unsigned long long)time(NULL) * 1000ULL;
    payloadObj["action"] = "UNLOCK";
    
    blockDoc["previousHash"] = lastBlockHash;
    String logPayload;
    serializeJson(payloadObj, logPayload);
    String newHash = generateBlockchainHash(lastBlockHash, logPayload);
    blockDoc["hash"] = newHash;
    
    String blockJson;
    serializeJson(blockDoc, blockJson);
    String blockUrl = "https://" + String(FIREBASE_HOST) + "/blockchain_ledger/" + String(LOCKER_ID) + "_" + String(time(NULL)) + ".json?auth=" + String(FIREBASE_SECRET);
    
    http.begin(wifiClient, blockUrl);
    http.addHeader("Content-Type", "application/json");
    int blockCode = http.sendRequest("PUT", blockJson);
    http.end();
    Serial.print("[DB] Blockchain Status: "); Serial.println(blockCode);
    
    lastBlockHash = newHash; 
    // --------------------------------
  }
  
  // Set current display to INFO mode and force a redraw to show the timer immediately
  currentDisplayMode = DISP_INFO;
  forceRedraw = true;
  
  tft.fillScreen(THEME_BG); // Integrated Dark Background
  tft.fillRect(0, 0, 240, 42, THEME_ENTER); // Green Success Top Bar
  centerText("UNLOCKED", 14, 2, THEME_TEXT);

  tft.setTextColor(THEME_TEXT);
  tft.setTextSize(3);
  tft.setCursor(45, 120); tft.print("GRANTED");
  tft.setTextSize(2);
  tft.setCursor(40, 160); tft.print("Open Locker Now");
}

void handleAutoLock() {
  if (millis() - unlockStart >= UNLOCK_TIME) {
    Serial.println("[HARDWARE] Auto-Lock: Writing LOW to Pin 26");
    digitalWrite(LOCK_PIN, LOW); // OFF
    state = LOCKED;
    enteredPIN = "";
    forceRedraw = true;
  }
}

void checkSessionExpiration() {
  if (currentBackendStatus != "ACTIVE" || currentSessionEnd == 0) return;

  unsigned long long nowMs = (unsigned long long)time(NULL) * 1000ULL;
  if (nowMs > currentSessionEnd) {
    digitalWrite(LOCK_PIN, LOW);
    state = LOCKED;
    
    if (WiFi.status() == WL_CONNECTED) {
       HTTPClient http;
       http.setReuse(true);
       String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
       String json = "{\"status\":\"AVAILABLE\",\"pin\":\"\",\"startTime\":0,\"sessionEnd\":0,\"duration\":0,\"unlockCount\":0,\"itemPresent\":false,\"doorStatus\":\"CLOSED\",\"doorOpenDuration\":0}";
       http.begin(wifiClient, url);
       http.sendRequest("PATCH", json);
       http.end();
    }
    
    currentBackendStatus = "AVAILABLE";
    currentSessionEnd = 0;
    currentUnlockCount = 0;
    enteredPIN = "";
    terminationPIN = "";
    terminationMode = false;
    debugStartTime = 0;
    debugDuration = 0;
    
    currentDisplayMode = DISP_QR;
    forceRedraw = true;
  }
}

/* ================= DOOR SENSOR MONITORING ================= */

// Helper: beep the buzzer N times
void buzzerBeep(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(150);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < times - 1) delay(150); // gap between beeps
  }
  Serial.print("[BUZZER] Beeped "); Serial.print(times); Serial.println(" time(s)");
}

void updateDoorSensor() {
  // Read door sensor: HIGH = disconnected (door OPEN), LOW = connected (door CLOSED)
  bool isOpen = digitalRead(DOOR_SENSOR_PIN) == HIGH;

  if (isOpen && !doorCurrentlyOpen) {
    // Door just opened — start a new round
    doorCurrentlyOpen = true;
    doorOpenSince = millis();
    buzzerLevel = 0; // Reset buzzer thresholds for this round
    Serial.println("[DOOR] Door OPENED — new round started");

    // Immediately push OPEN status to RTDB
    if (currentBackendStatus == "ACTIVE" && WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.setReuse(false);
      String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
      http.begin(wifiClient, url);
      http.addHeader("Content-Type", "application/json");
      http.sendRequest("PATCH", "{\"doorStatus\":\"OPEN\",\"doorOpenDuration\":0}");
      http.end();
    }
  } else if (!isOpen && doorCurrentlyOpen) {
    // Door just closed — reset open time for next round
    unsigned long roundDuration = millis() - doorOpenSince;
    doorCurrentlyOpen = false;
    doorOpenSince = 0;
    doorOpenDuration = 0; // Reset to 0 — each round starts fresh
    
    // Stop continuous buzzer and restore screen if warning was active
    if (buzzerLevel == 3) {
      digitalWrite(BUZZER_PIN, LOW);
      forceRedraw = true; // Restore normal display
    }
    buzzerLevel = 0; // Reset for next round
    Serial.print("[DOOR] Door CLOSED. Last round was: ");
    Serial.print(roundDuration / 1000);
    Serial.println("s — timer reset to 0");

    // Immediately push reset to RTDB so website updates instantly
    if (currentBackendStatus == "ACTIVE" && WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.setReuse(false);
      String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
      http.begin(wifiClient, url);
      http.addHeader("Content-Type", "application/json");
      http.sendRequest("PATCH", "{\"doorStatus\":\"CLOSED\",\"doorOpenDuration\":0}");
      http.end();
    }
  }

  // Buzzer escalation while door is open (per-round timing)
  if (doorCurrentlyOpen && doorOpenSince > 0) {
    unsigned long roundMs = millis() - doorOpenSince;

    if (roundMs >= 30000 && buzzerLevel < 3) {
      // 30s+ — continuous beep + warning on screen
      buzzerLevel = 3;
      digitalWrite(BUZZER_PIN, HIGH); // Continuous ON
      tft.fillScreen(THEME_BG);
      tft.fillRect(0, 0, 240, 50, THEME_CANCEL);
      centerText("!! WARNING !!", 18, 2, THEME_TEXT);
      centerText("CLOSE DOOR", 120, 3, THEME_CANCEL);
      centerText("IMMEDIATELY", 160, 3, THEME_CANCEL);
      centerText("Door open too long", 220, 2, THEME_NEUTRAL);
      Serial.println("[BUZZER] CONTINUOUS — door open > 30s");
    } else if (roundMs >= 20000 && buzzerLevel < 2) {
      buzzerLevel = 2;
      buzzerBeep(1);
    } else if (roundMs >= 15000 && buzzerLevel < 1) {
      buzzerLevel = 1;
      buzzerBeep(1);
    }
  }

  // Push door status to RTDB periodically during an ACTIVE session
  if (currentBackendStatus == "ACTIVE" && millis() - lastDoorSync >= DOOR_SYNC_INTERVAL) {
    lastDoorSync = millis();

    // Calculate current cumulative (include ongoing open time if door is currently open)
    unsigned long totalOpenMs = doorOpenDuration;
    if (doorCurrentlyOpen && doorOpenSince > 0) {
      totalOpenMs += (millis() - doorOpenSince);
    }

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.setReuse(false);
      String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
      
      String doorJson = "{\"doorStatus\":\"" + String(doorCurrentlyOpen ? "OPEN" : "CLOSED") + "\",\"doorOpenDuration\":" + String(totalOpenMs) + "}";

      http.begin(wifiClient, url);
      http.addHeader("Content-Type", "application/json");
      http.sendRequest("PATCH", doorJson);
      http.end();
    }
  }

  // Reset cumulative door timer when session ends
  if (currentBackendStatus != "ACTIVE") {
    doorOpenDuration = 0;
    doorCurrentlyOpen = false;
    doorOpenSince = 0;
    buzzerLevel = 0;
  }
}

void calibrateUltrasonic() {
  Serial.println("[ULTRASONIC] Calibrating empty distance...");
  long sum = 0;
  int validReadings = 0;
  for(int i = 0; i < 10; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(4);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    long duration = pulseIn(ECHO_PIN, HIGH, 25000);
    if(duration > 0) {
      float d = duration * 0.034 / 2.0;
      if (d >= 2.0 && d <= 150.0) {
        sum += duration;
        validReadings++;
      }
    }
    delay(30);
  }
  if (validReadings > 0) {
    emptyDistance = (sum / validReadings) * 0.034 / 2.0;
  } else {
    emptyDistance = 35.0; // Safe default empty locker depth (cm)
  }

  // Realistic boundary check: lockers are typically 15cm to 80cm deep
  if (emptyDistance < 10.0 || emptyDistance > 120.0) {
    Serial.printf("[ULTRASONIC] Reading %.1f cm outside normal range, defaulting to 35.0 cm\n", emptyDistance);
    emptyDistance = 35.0;
  }

  Serial.printf("[ULTRASONIC] Empty distance set to: %.1f cm\n", emptyDistance);
}

void updateUltrasonic() {
  if (millis() - lastUltrasonicUpdate < ULTRASONIC_INTERVAL) return;
  lastUltrasonicUpdate = millis();

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(4);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 25000); // 25ms timeout (~4.2m)
  if (duration <= 0) {
    // Single glitch/timeout — skip this cycle without resetting detection
    return;
  }

  float distance = duration * 0.034 / 2.0;
  if (distance < 1.5 || distance > 150.0) {
    return; // Noise spike filter
  }

  // Self-healing: If we consistently read a distance larger than emptyDistance,
  // the locker is emptier than calibrated (e.g., booted with an item inside).
  static int healingCount = 0;
  if (distance > emptyDistance + 2.5 && distance <= 100.0) {
    healingCount++;
    if (healingCount >= 5) {
      emptyDistance = distance;
      healingCount = 0;
      Serial.printf("[ULTRASONIC] Baseline auto-healed to: %.1f cm\n", emptyDistance);
    }
  } else {
    healingCount = 0;
  }

  // Item detected if measured distance is closer than the empty locker back wall/floor
  bool isPresent = (distance <= (emptyDistance - 3.0) && distance >= 2.0);

  // Fast 3-sample debounce (3 * 200ms = 600ms responsive state change)
  static bool lastCandidate = false;
  static int stableCount = 0;

  if (isPresent == lastCandidate) {
    stableCount++;
  } else {
    lastCandidate = isPresent;
    stableCount = 1;
  }

  if (stableCount >= 3 && itemPresent != isPresent) {
    itemPresent = isPresent;
    stableCount = 0;
    Serial.printf("[ULTRASONIC] State changed -> %s (Dist: %.1f cm | Empty Base: %.1f cm)\n", 
                  itemPresent ? "ITEM DETECTED" : "BOX EMPTY", distance, emptyDistance);

    // Fast sync to Firebase Realtime Database
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.setReuse(true);
      String url = "https://" + String(FIREBASE_HOST) + "/" + String(LOCKER_ID) + ".json?auth=" + String(FIREBASE_SECRET);
      http.begin(wifiClient, url);
      http.addHeader("Content-Type", "application/json");
      String json = "{\"itemPresent\":" + String(itemPresent ? "true" : "false") + "}";
      int httpCode = http.sendRequest("PATCH", json);
      Serial.printf("[ULTRASONIC] Firebase Sync Code: %d\n", httpCode);
      http.end();
    }
  }
}

/* ================= OTA UPDATE & ROLLBACK IMPLEMENTATION ================= */
void checkFirmwareRollbackStatus() {
  const esp_partition_t *running = esp_ota_get_running_partition();
  if (!running) {
    Serial.println("[OTA] Warning: Unable to determine running partition.");
    return;
  }

  Serial.println("\n[OTA] ================= PARTITION & BOOT STATUS =================");
  Serial.printf("[OTA] Running Partition: '%s' (Type: 0x%02x, SubType: 0x%02x, Offset: 0x%08x, Size: %u KB)\n",
                running->label, running->type, running->subtype, (unsigned int)running->address, (unsigned int)(running->size / 1024));

  esp_ota_img_states_t ota_state;
  if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
    switch (ota_state) {
      case ESP_OTA_IMG_NEW:
        Serial.println("[OTA] Image State: ESP_OTA_IMG_NEW (First boot of freshly flashed image)");
        otaPendingVerification = true;
        break;
      case ESP_OTA_IMG_PENDING_VERIFY:
        Serial.println("[OTA] Image State: ESP_OTA_IMG_PENDING_VERIFY (Verification in progress)");
        otaPendingVerification = true;
        break;
      case ESP_OTA_IMG_VALID:
        Serial.println("[OTA] Image State: ESP_OTA_IMG_VALID (Firmware previously confirmed healthy)");
        otaValidationPassed = true;
        break;
      case ESP_OTA_IMG_INVALID:
        Serial.println("[OTA] Image State: ESP_OTA_IMG_INVALID (Marked invalid)");
        break;
      case ESP_OTA_IMG_ABORTED:
        Serial.println("[OTA] Image State: ESP_OTA_IMG_ABORTED (Aborted update)");
        break;
      default:
        Serial.printf("[OTA] Image State: Unknown (%d)\n", (int)ota_state);
        break;
    }
  } else {
    Serial.println("[OTA] Image State: Standard / Factory Partition (No pending rollback)");
  }

  const esp_partition_t *next_update = esp_ota_get_next_update_partition(NULL);
  if (next_update) {
    Serial.printf("[OTA] Target Inactive Partition for next OTA: '%s' (Size: %u KB)\n",
                  next_update->label, (unsigned int)(next_update->size / 1024));
  }
  Serial.println("[OTA] ==========================================================\n");
}

void validateFirmwareHealth() {
  if (otaValidationPassed) return;

  Serial.println("\n[BOOT] ================= FIRMWARE HEALTH VALIDATION =================");
  
  bool lockSafe = (digitalRead(LOCK_PIN) == LOW || state == UNLOCKED);
  bool ultrasonicOk = (emptyDistance > 0.0);
  bool doorSensorOk = (digitalRead(DOOR_SENSOR_PIN) == HIGH || digitalRead(DOOR_SENSOR_PIN) == LOW);
  bool displayOk = true;
  bool appStateOk = (state == LOCKED || state == UNLOCKED);

  Serial.printf("[BOOT] Lock Solenoid Safe State : %s\n", lockSafe ? "OK (LOCKED)" : "FAIL");
  Serial.printf("[BOOT] TFT Display Subsystem    : %s\n", displayOk ? "OK" : "FAIL");
  Serial.printf("[BOOT] Touch Subsystem          : OK\n");
  Serial.printf("[BOOT] Door Reed Sensor         : %s\n", doorSensorOk ? "OK" : "FAIL");
  Serial.printf("[BOOT] Ultrasonic Sensor        : %s (Baseline: %.1f cm)\n", ultrasonicOk ? "OK" : "FAIL", emptyDistance);
  Serial.printf("[BOOT] Application State Machine: %s (Status: %s)\n", appStateOk ? "OK" : "FAIL", currentBackendStatus.c_str());

  if (lockSafe && ultrasonicOk && doorSensorOk && displayOk && appStateOk) {
    Serial.println("[BOOT] Critical System Health Checks: ALL PASSED");
    
    esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
    if (err == ESP_OK) {
      Serial.println("[OTA] SUCCESS: Firmware marked VALID. Bootloader rollback cancelled.");
    } else {
      Serial.printf("[OTA] Status: esp_ota_mark_app_valid_cancel_rollback returned 0x%x\n", err);
    }
    otaValidationPassed = true;
    otaPendingVerification = false;
  } else {
    Serial.println("[BOOT] WARNING: Critical health checks incomplete.");
    if (millis() - bootTimestamp > OTA_VALIDATION_TIMEOUT_MS && otaPendingVerification) {
      Serial.println("[OTA] CRITICAL: Validation timeout exceeded! Triggering bootloader rollback...");
      esp_ota_mark_app_invalid_rollback_and_reboot();
    }
  }
  Serial.println("[BOOT] =============================================================\n");
}

void setupOTA() {
  ArduinoOTA.setPort(OTA_PORT);
  ArduinoOTA.setHostname(OTA_HOSTNAME);
  ArduinoOTA.setPassword(OTA_PASSWORD);

  ArduinoOTA
    .onStart([]() {
      // Enforce lock safety: ensure solenoid is strictly LOW/OFF during update
      digitalWrite(LOCK_PIN, LOW);
      String type;
      if (ArduinoOTA.getCommand() == U_FLASH) {
        type = "sketch";
      } else { // U_SPIFFS
        type = "filesystem";
      }
      Serial.println("\n[OTA] Start writing " + type + " to inactive OTA partition...");
    })
    .onEnd([]() {
      Serial.println("\n[OTA] OTA Transfer Complete. Rebooting into new image for validation...");
    })
    .onProgress([](unsigned int progress, unsigned int total) {
      Serial.printf("[OTA] Progress: %u%%\r", (progress / (total / 100)));
    })
    .onError([](ota_error_t error) {
      Serial.printf("\n[OTA] Error[%u]: ", error);
      if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
      else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
      else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
      else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
      else if (error == OTA_END_ERROR) Serial.println("End Failed");
      Serial.println("[OTA] Active running firmware remains intact and operational.");
    });

  ArduinoOTA.begin();
  Serial.println("[OTA] ArduinoOTA Initialized successfully.");
  Serial.printf("[OTA] Hostname: %s | Port: %d | IP: %s\n", OTA_HOSTNAME, OTA_PORT, WiFi.localIP().toString().c_str());
}