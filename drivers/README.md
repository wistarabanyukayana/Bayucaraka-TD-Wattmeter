# Hardware Drivers & USB-to-Serial Setup 🔌

This directory contains device drivers and documentation for connecting clone Arduino Uno/Nano boards to the host system.

---

## 📦 Bundled Drivers

- **[CH340 / CH341 USB-Serial Driver](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/drivers/CH340)**:
  - Many cheap or clone Arduino boards use the inexpensive WCH CH340 or CH341 USB-to-serial bridge chips rather than the ATmega16U2 found on official Uno boards.
  - On Windows, these clones require a specific driver to be recognized as COM ports.
  - This folder contains `CH34x_Install_Windows_v3_4.EXE`, a redistributable driver installer for Windows platforms.

---

## 🖥 Native Application Integration

The **Wattmeter Viewer Desktop App** integrates directly with this directory:
- When a user encounters connection issues, clicking the **"Driver Help"** button in the Electron app interface will automatically open this `drivers/` folder in the OS native file explorer (Windows Explorer or macOS Finder).
- This allows users to easily find and run the driver installers manually without having to search online.
- Manual installation is preferred since driver installation requires Administrator permissions (UAC on Windows).

---

## 🔧 Installation Instructions

### Windows
1. Open the [CH340 directory](file:///home/wistarabanyukayana/Documents/Bayucaraka/arduino-workspace/Wattmeter/drivers/CH340).
2. Double-click `CH34x_Install_Windows_v3_4.EXE`.
3. Click the **Install** button.
4. Plug in your Arduino. It should appear in Device Manager under `Ports (COM & LPT)` as `USB-SERIAL CH340 (COMx)`.

### macOS / Linux
- **Linux**: The CH340 driver is built-in natively in the Linux kernel (`ch341` module). No driver installation is required. Ensure your user is part of the `dialout` or `uucp` group to access serial ports:
  ```bash
  sudo usermod -a -G dialout $USER
  ```
- **macOS**: Recent versions of macOS (High Sierra 10.13 and later) have built-in support for CH340 devices. If your board is not recognized, you can download the latest official WCH macOS driver from the [WCH official website](https://www.wch.cn).
