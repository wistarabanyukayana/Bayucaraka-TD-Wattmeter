# Wattmeter LCD Sniffer Firmware 📡

This directory contains the Arduino Uno/Nano firmware that intercepts and decodes characters sent to a 16x2 HD44780 LCD screen of a commercial wattmeter.

---

## 💡 How It Works

Instead of modifying the internal software of the commercial wattmeter, the sniffer operates by **listening in** on the LCD control and data lines. 

1. **Interrupt-Driven Capture**: The Arduino registers an interrupt on Pin 3, connected to the LCD's **E (Enable)** line.
2. **Nibble Assembly**: HD44780 LCD screens commonly operate in **4-bit mode**. When the E line goes from HIGH to LOW, the sniffer reads the four data lines (D4-D7) and registers the nibble. Two consecutive nibbles form a full 8-bit command or character byte.
3. **Queue Processing**: Bytes are stored in a lock-free circular queue and processed in the main loop to avoid blocking the hardware interrupts.
4. **Virtual Screen Replication**: The firmware tracks cursor movement, line clears, and memory addresses (DDRAM) to maintain a live replica of the 16x2 text matrix in the Arduino's RAM.
5. **Pattern Parsing**: The firmware continuously scans the replica screen looking for voltage, current, power, and accumulation units (e.g. `V`, `A`, `W`, `Ah`, `Wh`) and extracts their numerical values using a float parser.
6. **High-Speed Serial Streaming**: Parsed values are formatted into CSV-style payload strings and broadcast over USB-Serial at **250000 baud** to the client applications.

---

## 🔌 Pin Mapping & Wiring Guide

Connect the Arduino pins in parallel with the LCD bus lines between the wattmeter's controller and its LCD screen:

```text
Host Wattmeter LCD                Arduino Uno / Nano
+------------------+             +-------------------+
|  1. VSS (GND)    |------------>|       GND         |  <-- MANDATORY Common Ground
|  4. RS           |------------>|   D2 (RS Input)   |
|  6. E            |------------>|   D3 (E Interrupt)|  <-- Hardware Interrupt INT1
|  11. D4          |------------>|   D4 (Data Input) |
|  12. D5          |------------>|   D5 (Data Input) |
|  13. D6          |------------>|   D6 (Data Input) |
|  14. D7          |------------>|   D7 (Data Input) |
+------------------+             +-------------------+
```

> [!CAUTION]  
> Do not connect the LCD **VCC (5V/3.3V)** line to your Arduino. The Arduino should be powered via USB, and only the Ground pin must be shared with the host wattmeter to establish a common voltage reference. Connecting power rails together may damage your boards.

---

## 📊 Serial Payload Format

The sniffer outputs standardized CSV rows over USB-Serial every time the screen updates or periodically. 

### Output Format
```text
DATA,A=<Amps>,V=<Volts>,W=<Watts>,ACTIVE=<ActiveFields>,STALE=<StaleStatus>
```

- **`A`**: Floating-point current (Amperes).
- **`V`**: Floating-point voltage (Volts).
- **`W`**: Floating-point active power (Watts).
- **`ACTIVE`**: Pipe-delimited (`|`) list of fields actively visible on the LCD screen during the current frame (e.g. `A|V|W`).
- **`STALE`**: Binary status (`0` or `1`). Becomes `1` if no LCD bus transaction is detected for more than 3 seconds (indicating the host device is asleep or powered off).

### Example Raw Output
```text
DATA,A=1.450,V=220.50,W=319.7,ACTIVE=A|V|W,STALE=0
DATA,A=1.452,V=220.40,W=320.0,ACTIVE=A|V|W,STALE=0
```

---

## 🛠 Compilation and Upload Settings

To compile the sketch in the **Arduino IDE** or **VS Code (PlatformIO)**:

1. **Board**: `Arduino Uno` or `Arduino Nano` (ATmega328P).
2. **Processor** (if Nano): `ATmega328P` or `ATmega328P (Old Bootloader)` depending on your clone board.
3. **Baud Rate**: **`250000`** is required for streaming. Normal 9600 or 115200 baud will overflow the buffer when the screen refreshes rapidly.
