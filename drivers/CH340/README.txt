CH340 / CH341 Windows USB Serial Driver
=======================================

Many Arduino Uno clone boards use a CH340/CH341 USB-serial chip. On Windows,
Device Manager should show the board as:

  USB-SERIAL CH340 (COMx)

If it shows "USB Serial" with a warning icon, install the CH340/CH341 driver,
then unplug and reconnect the Arduino.

Driver package
--------------

Place the redistributable Windows driver installer in this folder before
building the Windows release, for example:

  CH341SER.EXE

The app's "Driver Help" button opens this folder so the user can run the driver
installer manually. Manual installation is intentional: Windows driver installs
usually require administrator permission and a signed driver package.

Redistribution note
-------------------

Only include a driver installer here if you have the right to redistribute that
driver package. If you do not, ship this README and direct users to install the
driver from their board vendor.
