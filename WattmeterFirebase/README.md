# Wattmeter Firebase Viewer

Static browser version of the wattmeter viewer for Firebase Hosting.

## Run Locally

Serve the `WattmeterFirebase` folder from `localhost`; Web Serial is only available in secure contexts such as HTTPS or localhost.

```bash
firebase emulators:start --only hosting
```

or:

```bash
firebase hosting:channel:deploy preview
```

## Deploy

From the `Wattmeter` directory:

```bash
firebase deploy --only hosting
```

The hosted app uses `navigator.serial.requestPort()` from the Connect button. Browsers require a user gesture before showing the serial chooser, so the chooser cannot be opened automatically during page load.
