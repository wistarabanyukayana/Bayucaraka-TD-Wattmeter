// ===================================================
// WATTMETER LCD SNIFFER
// Arduino Uno, HD44780 4-bit LCD bus sniffer
//
// Wiring assumption:
//   D2 = LCD RS
//   D3 = LCD E
//   D4 = LCD D4
//   D5 = LCD D5
//   D6 = LCD D6
//   D7 = LCD D7
//
// Serial Monitor:
//   250000 baud, A/V/W + compact status
// ===================================================

const byte RS_MASK = _BV(2);
const byte E_MASK = _BV(3);
const byte DATA_MASK = 0xF0;

const byte LCD_ROWS = 2;
const byte LCD_COLS = 16;
const byte LCD_EVENT_QUEUE_SIZE = 128;
const byte LCD_EVENT_QUEUE_MASK = LCD_EVENT_QUEUE_SIZE - 1;
const unsigned long NIBBLE_TIMEOUT_US = 5000;
const unsigned long SERIAL_BAUD = 250000;
const unsigned long DATA_OUTPUT_INTERVAL_MS = 1;
const unsigned long SCREEN_PARSE_SETTLE_MS = 80;
const unsigned long LCD_STALE_TIMEOUT_MS = 3000;
const bool PRINT_DATA_LINES = true;

const byte FIELD_A = _BV(0);
const byte FIELD_V = _BV(1);
const byte FIELD_W = _BV(2);
const byte FIELD_AH = _BV(3);
const byte FIELD_WH = _BV(4);
const byte FIELD_VM = _BV(5);
const byte FIELD_WP = _BV(6);
const byte FIELD_AP = _BV(7);

char lcd[LCD_ROWS][LCD_COLS + 1];

volatile byte lcdEventValue[LCD_EVENT_QUEUE_SIZE];
volatile byte lcdEventRs[LCD_EVENT_QUEUE_SIZE];
volatile byte lcdEventHead = 0;
volatile byte lcdEventTail = 0;
volatile unsigned int droppedLcdEvents = 0;

volatile byte isrHighNibble = 0;
volatile bool isrHighNibbleRS = false;
volatile bool isrWaitingForHighNibble = true;
volatile unsigned long isrLastNibbleTimeUs = 0;

byte ddramAddress = 0;
bool entryIncrement = true;

bool screenDirty = true;
unsigned long lastDataOutputMs = 0;
unsigned long lastScreenChangeMs = 0;
unsigned long lastLcdActivityMs = 0;
byte activeFields = 0;

struct ReadingState {
  float amps;
  float volts;
  float watts;
  float ampHours;
  float wattHours;
  float voltsMax;
  float wattsPeak;
  float ampsPeak;
  bool hasAmps;
  bool hasVolts;
  bool hasWatts;
  bool hasAmpHours;
  bool hasWattHours;
  bool hasVoltsMax;
  bool hasWattsPeak;
  bool hasAmpsPeak;
};

ReadingState readings;

bool isDigitChar(char ch) {
  return ch >= '0' && ch <= '9';
}

bool isAlphaChar(char ch) {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
}

char toUpperChar(char ch) {
  if (ch >= 'a' && ch <= 'z') {
    return ch - 32;
  }
  return ch;
}

bool isNumberStart(const char *text, byte pos) {
  char ch = text[pos];
  if (isDigitChar(ch)) {
    return true;
  }
  if (ch == '.' && isDigitChar(text[pos + 1])) {
    return true;
  }
  if ((ch == '-' || ch == '+') && (isDigitChar(text[pos + 1]) || text[pos + 1] == '.')) {
    return true;
  }
  return false;
}

bool isSeparator(char ch) {
  return ch == ' ' || ch == ':' || ch == '=' || ch == '_' || ch == '-';
}

float absFloat(float value) {
  if (value < 0.0) {
    return -value;
  }
  return value;
}

bool matchesAt(const char *text, byte pos, const char *word) {
  byte i = 0;
  while (word[i] != '\0') {
    if (text[pos + i] == '\0') {
      return false;
    }
    if (text[pos + i] != word[i]) {
      return false;
    }
    i++;
  }
  return true;
}

byte skipSeparatorsForward(const char *text, byte pos) {
  while (text[pos] != '\0' && isSeparator(text[pos])) {
    pos++;
  }
  return pos;
}

float parseNumber(const char *text, byte *pos, byte *digitCount, bool *hasDecimal) {
  bool negative = false;
  float value = 0.0;
  float divisor = 10.0;
  *digitCount = 0;
  *hasDecimal = false;

  if (text[*pos] == '-' || text[*pos] == '+') {
    negative = text[*pos] == '-';
    (*pos)++;
  }

  while (isDigitChar(text[*pos])) {
    value = (value * 10.0) + (text[*pos] - '0');
    (*digitCount)++;
    (*pos)++;
  }

  if (text[*pos] == '.') {
    *hasDecimal = true;
    (*pos)++;
    while (isDigitChar(text[*pos])) {
      value += (float)(text[*pos] - '0') / divisor;
      divisor *= 10.0;
      (*digitCount)++;
      (*pos)++;
    }
  }

  if (negative) {
    value = -value;
  }

  return value;
}

void clearVirtualLcd() {
  for (byte r = 0; r < LCD_ROWS; r++) {
    for (byte c = 0; c < LCD_COLS; c++) {
      lcd[r][c] = ' ';
    }
    lcd[r][LCD_COLS] = '\0';
  }
  ddramAddress = 0;
  screenDirty = true;
  lastScreenChangeMs = millis();
}

bool mapDdramToCursor(byte address, byte *row, byte *col) {
  if (address < LCD_COLS) {
    *row = 0;
    *col = address;
    return true;
  }

  if (address >= 0x40 && address < 0x40 + LCD_COLS) {
    *row = 1;
    *col = address - 0x40;
    return true;
  }

  return false;
}

void advanceDdramAddress() {
  if (entryIncrement) {
    ddramAddress++;
  } else if (ddramAddress > 0) {
    ddramAddress--;
  }
}

void handleLcdCommand(byte value) {
  if (value == 0x01) {
    clearVirtualLcd();
    return;
  }

  if (value == 0x02) {
    ddramAddress = 0;
    return;
  }

  if ((value & 0x80) != 0) {
    ddramAddress = value & 0x7F;
    return;
  }

  if ((value & 0xFC) == 0x04) {
    entryIncrement = (value & 0x02) != 0;
    return;
  }
}

void handleLcdData(byte value) {
  byte row = 0;
  byte col = 0;

  if (mapDdramToCursor(ddramAddress, &row, &col)) {
    char ch = ' ';
    if (value >= 32 && value <= 126) {
      ch = (char)value;
    }

    if (lcd[row][col] != ch) {
      lcd[row][col] = ch;
      screenDirty = true;
      lastScreenChangeMs = millis();
    }
  }

  advanceDdramAddress();
}

void handleLcdByte(byte value, bool rs) {
  if (rs) {
    handleLcdData(value);
  } else {
    handleLcdCommand(value);
  }
}

void pushLcdEventFromIsr(byte value, bool rs) {
  byte nextHead = (lcdEventHead + 1) & LCD_EVENT_QUEUE_MASK;
  if (nextHead == lcdEventTail) {
    droppedLcdEvents++;
    return;
  }

  lcdEventValue[lcdEventHead] = value;
  lcdEventRs[lcdEventHead] = rs ? 1 : 0;
  lcdEventHead = nextHead;
}

void onLcdEnableRise() {
  byte portState = PIND;
  byte nibble = (portState & DATA_MASK) >> 4;
  bool rs = (portState & RS_MASK) != 0;
  unsigned long nowUs = micros();

  if (!isrWaitingForHighNibble && (nowUs - isrLastNibbleTimeUs > NIBBLE_TIMEOUT_US)) {
    isrWaitingForHighNibble = true;
  }

  if (isrWaitingForHighNibble) {
    isrHighNibble = nibble & 0x0F;
    isrHighNibbleRS = rs;
    isrLastNibbleTimeUs = nowUs;
    isrWaitingForHighNibble = false;
    return;
  }

  if (rs != isrHighNibbleRS) {
    isrHighNibble = nibble & 0x0F;
    isrHighNibbleRS = rs;
    isrLastNibbleTimeUs = nowUs;
    isrWaitingForHighNibble = false;
    return;
  }

  byte value = (isrHighNibble << 4) | (nibble & 0x0F);
  isrWaitingForHighNibble = true;
  isrLastNibbleTimeUs = nowUs;
  pushLcdEventFromIsr(value, rs);
}

bool popLcdEvent(byte *value, bool *rs) {
  noInterrupts();
  if (lcdEventTail == lcdEventHead) {
    interrupts();
    return false;
  }

  byte tail = lcdEventTail;
  *value = lcdEventValue[tail];
  *rs = lcdEventRs[tail] != 0;
  lcdEventTail = (tail + 1) & LCD_EVENT_QUEUE_MASK;
  interrupts();
  return true;
}

void processLcdEvents() {
  byte value = 0;
  bool rs = false;
  while (popLcdEvent(&value, &rs)) {
    lastLcdActivityMs = millis();
    handleLcdByte(value, rs);
  }
}

void buildVisibleText(char *out, byte outSize) {
  byte idx = 0;
  for (byte r = 0; r < LCD_ROWS; r++) {
    for (byte c = 0; c < LCD_COLS && idx < outSize - 1; c++) {
      out[idx++] = toUpperChar(lcd[r][c]);
    }
    if (r + 1 < LCD_ROWS && idx < outSize - 1) {
      out[idx++] = ' ';
    }
  }
  out[idx] = '\0';
}

bool previousWordIsNear(const char *text, byte numberStart, const char *word) {
  int pos = numberStart - 1;
  byte gap = 0;
  while (pos >= 0 && isSeparator(text[pos])) {
    pos--;
    gap++;
  }

  if (gap > 2) {
    return false;
  }

  int end = pos + 1;
  while (pos >= 0 && isAlphaChar(text[pos])) {
    pos--;
  }

  int start = pos + 1;
  byte wordLen = 0;
  while (word[wordLen] != '\0') {
    wordLen++;
  }

  if (end - start != wordLen) {
    return false;
  }

  for (byte i = 0; i < wordLen; i++) {
    if (text[start + i] != word[i]) {
      return false;
    }
  }

  return true;
}

bool nextWordIsNear(const char *text, byte numberEnd, const char *word) {
  byte pos = numberEnd;
  byte gap = 0;
  while (text[pos] != '\0' && isSeparator(text[pos])) {
    pos++;
    gap++;
  }

  if (gap > 2) {
    return false;
  }

  return matchesAt(text, pos, word);
}

bool validRange(float value, float minValue, float maxValue) {
  return value >= minValue && value <= maxValue;
}

float normalizeDotlessCandidate(float value, byte digitCount, float minValue, float maxValue, bool hasLast, float lastValue) {
  if (validRange(value, minValue, maxValue)) {
    return value;
  }

  float bestValue = value;
  float bestDiff = 1000000000.0;
  bool hasBest = false;

  float scale = 10.0;
  for (byte i = 0; i < 3; i++) {
    float candidate = value / scale;
    if (validRange(candidate, minValue, maxValue)) {
      float diff = hasLast ? absFloat(candidate - lastValue) : 0.0;
      if (!hasBest || diff < bestDiff) {
        bestValue = candidate;
        bestDiff = diff;
        hasBest = true;
      }
    }
    scale *= 10.0;
  }

  if (hasBest && hasLast) {
    return bestValue;
  }

  if (hasBest && digitCount >= 5) {
    return value / 100.0;
  }

  if (hasBest && digitCount == 4) {
    return value / 10.0;
  }

  if (hasBest) {
    return bestValue;
  }

  return value;
}

float normalizeVoltageValue(float value, byte digitCount, bool hasDecimal, bool hasLast, float lastValue) {
  if (!hasDecimal) {
    value = normalizeDotlessCandidate(value, digitCount, 0.0, 1000.0, hasLast, lastValue);
  }

  if (!hasDecimal && hasLast && absFloat(value - lastValue) > 80.0) {
    return lastValue;
  }

  return value;
}

void setVolts(float value, byte digitCount, bool hasDecimal) {
  value = normalizeVoltageValue(value, digitCount, hasDecimal, readings.hasVolts, readings.volts);

  if (validRange(value, 0.0, 1000.0)) {
    readings.volts = value;
    readings.hasVolts = true;
    activeFields |= FIELD_V;
  }
}

void setVoltsMax(float value, byte digitCount, bool hasDecimal) {
  value = normalizeVoltageValue(value, digitCount, hasDecimal, readings.hasVoltsMax, readings.voltsMax);

  if (validRange(value, 0.0, 1000.0)) {
    readings.voltsMax = value;
    readings.hasVoltsMax = true;
    activeFields |= FIELD_VM;
  }
}

void setAmps(float value) {
  if (validRange(value, 0.0, 100000.0)) {
    readings.amps = value;
    readings.hasAmps = true;
    activeFields |= FIELD_A;
  }
}

void setWatts(float value) {
  if (validRange(value, -1000000.0, 1000000.0)) {
    readings.watts = value;
    readings.hasWatts = true;
    activeFields |= FIELD_W;
  }
}

void setAmpHours(float value) {
  if (validRange(value, 0.0, 100000000.0)) {
    readings.ampHours = value;
    readings.hasAmpHours = true;
    activeFields |= FIELD_AH;
  }
}

void setWattHours(float value) {
  if (validRange(value, 0.0, 100000000.0)) {
    readings.wattHours = value;
    readings.hasWattHours = true;
    activeFields |= FIELD_WH;
  }
}

void setWattsPeak(float value) {
  if (validRange(value, -1000000.0, 1000000.0)) {
    readings.wattsPeak = value;
    readings.hasWattsPeak = true;
    activeFields |= FIELD_WP;
  }
}

void setAmpsPeak(float value) {
  if (validRange(value, 0.0, 100000.0)) {
    readings.ampsPeak = value;
    readings.hasAmpsPeak = true;
    activeFields |= FIELD_AP;
  }
}

void classifyAndStoreValue(const char *text, byte numberStart, byte numberEnd, float value, byte digitCount, bool hasDecimal) {
  if (nextWordIsNear(text, numberEnd, "MAH")) {
    return;
  }
  if (nextWordIsNear(text, numberEnd, "KWH")) {
    return;
  }
  if (nextWordIsNear(text, numberEnd, "AH")) {
    return;
  }
  if (nextWordIsNear(text, numberEnd, "WH")) {
    return;
  }
  if (nextWordIsNear(text, numberEnd, "VM")) {
    return;
  }
  if (nextWordIsNear(text, numberEnd, "WP")) {
    return;
  }
  if (nextWordIsNear(text, numberEnd, "AP")) {
    return;
  }
  if (nextWordIsNear(text, numberEnd, "KVA") || nextWordIsNear(text, numberEnd, "VA")) {
    return;
  }
  if (nextWordIsNear(text, numberEnd, "KW")) {
    setWatts(value * 1000.0);
    return;
  }
  if (nextWordIsNear(text, numberEnd, "MA")) {
    setAmps(value / 1000.0);
    return;
  }
  if (nextWordIsNear(text, numberEnd, "V")) {
    setVolts(value, digitCount, hasDecimal);
    return;
  }
  if (nextWordIsNear(text, numberEnd, "W")) {
    setWatts(value);
    return;
  }
  if (nextWordIsNear(text, numberEnd, "A")) {
    setAmps(value);
    return;
  }

  if (previousWordIsNear(text, numberStart, "MAH")) {
    return;
  }
  if (previousWordIsNear(text, numberStart, "KWH")) {
    return;
  }
  if (previousWordIsNear(text, numberStart, "AH")) {
    return;
  }
  if (previousWordIsNear(text, numberStart, "WH")) {
    return;
  }
  if (previousWordIsNear(text, numberStart, "VM")) {
    return;
  }
  if (previousWordIsNear(text, numberStart, "WP")) {
    return;
  }
  if (previousWordIsNear(text, numberStart, "AP")) {
    return;
  }
  if (previousWordIsNear(text, numberStart, "KW")) {
    setWatts(value * 1000.0);
    return;
  }
  if (previousWordIsNear(text, numberStart, "MA")) {
    setAmps(value / 1000.0);
    return;
  }
  if (previousWordIsNear(text, numberStart, "V")) {
    setVolts(value, digitCount, hasDecimal);
    return;
  }
  if (previousWordIsNear(text, numberStart, "W")) {
    setWatts(value);
    return;
  }
  if (previousWordIsNear(text, numberStart, "A")) {
    setAmps(value);
    return;
  }
}

void parseVisibleScreen() {
  char text[(LCD_ROWS * LCD_COLS) + LCD_ROWS];
  buildVisibleText(text, sizeof(text));
  activeFields = 0;

  byte pos = 0;
  while (text[pos] != '\0') {
    if (!isNumberStart(text, pos)) {
      pos++;
      continue;
    }

    byte numberStart = pos;
    byte digitCount = 0;
    bool hasDecimal = false;
    float value = parseNumber(text, &pos, &digitCount, &hasDecimal);
    byte numberEnd = pos;
    classifyAndStoreValue(text, numberStart, numberEnd, value, digitCount, hasDecimal);
  }
}

void printValue(bool hasValue, float value, byte decimals) {
  if (!hasValue) {
    Serial.print(F("nan"));
    return;
  }

  Serial.print(value, decimals);
}

bool lcdSignalStale() {
  return lastLcdActivityMs == 0 || millis() - lastLcdActivityMs > LCD_STALE_TIMEOUT_MS;
}

void printActiveField(byte mask, const __FlashStringHelper *label, bool *printedAny) {
  if ((activeFields & mask) == 0) {
    return;
  }

  if (*printedAny) {
    Serial.print('|');
  }

  Serial.print(label);
  *printedAny = true;
}

void printActiveFields(bool stale) {
  bool printedAny = false;
  Serial.print(F(",ACTIVE="));
  if (stale) {
    Serial.print(F("none"));
    return;
  }

  printActiveField(FIELD_A, F("A"), &printedAny);
  printActiveField(FIELD_V, F("V"), &printedAny);
  printActiveField(FIELD_W, F("W"), &printedAny);
  if (!printedAny) {
    Serial.print(F("none"));
  }
}

void printDataLine() {
  unsigned int dropped = 0;
  bool stale = lcdSignalStale();
  noInterrupts();
  dropped = droppedLcdEvents;
  interrupts();

  Serial.print(F("DATA,A="));
  printValue(readings.hasAmps, readings.amps, 3);
  Serial.print(F(",V="));
  printValue(readings.hasVolts, readings.volts, 2);
  Serial.print(F(",W="));
  printValue(readings.hasWatts, readings.watts, 2);
  printActiveFields(stale);
  Serial.print(F(",STALE="));
  Serial.print(stale ? 1 : 0);
  if (dropped > 0) {
    Serial.print(F(",DROP="));
    Serial.print(dropped);
  }
  Serial.println();
}

void printOutputsIfDue() {
  unsigned long nowMs = millis();

  bool dataDue = nowMs - lastDataOutputMs >= DATA_OUTPUT_INTERVAL_MS;

  if (!dataDue) {
    return;
  }

  if (screenDirty && nowMs - lastScreenChangeMs >= SCREEN_PARSE_SETTLE_MS) {
    parseVisibleScreen();
    screenDirty = false;
  }

  if (PRINT_DATA_LINES) {
    printDataLine();
  }
  lastDataOutputMs = nowMs;
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1000);

  DDRD &= 0x03;
  PORTD &= 0x03;

  clearVirtualLcd();
  attachInterrupt(digitalPinToInterrupt(3), onLcdEnableRise, RISING);
}

void loop() {
  processLcdEvents();
  printOutputsIfDue();
  processLcdEvents();
}
