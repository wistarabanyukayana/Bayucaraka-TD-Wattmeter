# Wattmeter Firebase Web App 🌐

The production-ready browser version of the **Bayucaraka TD Wattmeter Viewer** compiled for **Firebase Hosting**. This version leverages the native, in-browser **Web Serial API** to allow direct client-side communication with the Arduino hardware without requiring any local app downloads or desktop installations.

---

## ⚡ Key Web Implementation Notes

- **Secure Context Restrictions**: The Web Serial API (`navigator.serial`) is strictly bound to secure contexts by modern browser standards. It will only execute over **HTTPS** or **Localhost** (`127.0.0.1`).
- **User Gesture Requirement**: For security, browsers require a direct user action (such as clicking the **Connect** button) before displaying the serial port selection dialog. The app cannot trigger this popup automatically during page load.
- **Chrome / Edge Compatible**: Works out-of-the-box on Chrome, Edge, and Opera. Safari and Firefox are not supported due to their lack of Web Serial API support.

---

## 🚀 Local Development and Emulation

To test and run the Firebase version locally inside a simulated production hosting environment:

1. Make sure you have the [Firebase CLI](https://firebase.google.com/docs/cli) installed globally.
2. Run the local hosting emulator from the project's root folder:
   ```bash
   firebase emulators:start --only hosting
   ```
3. Open your browser and navigate to **`http://localhost:5000`** (or the alternative port displayed in your terminal).

Alternatively, you can generate a secure, temporary preview channel link hosted live on Google's CDN:
```bash
firebase hosting:channel:deploy preview
```

---

## ☁️ Deployment to Firebase Hosting

When you are ready to push the latest static changes to live production, execute the following command from the root directory:

```bash
firebase deploy --only hosting
```

Your app will be built, cached, and served globally through Firebase's fast SSD-based content delivery network (CDN).
