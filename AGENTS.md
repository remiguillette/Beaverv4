# Beaverv4
Excellent project 👏 — you're essentially describing a **mini-hybrid desktop infrastructure**, where:

* 🧠 **Node.js (TypeScript/React)** serves as the system "daemon"/backend (IPC + HTTP server),
* 🪟 **GTK 4.0** is your **native frontend** (GUI that displays the "desktop"),
* ⚙️ The two communicate via **IPC** (for system information, launching apps, etc.),
* 🧩 And you want a `./start` script that starts everything cleanly.

It's doable — let's see how to structure it properly.

---

## 🏗️ General Architecture

```
+----------------------+
| Node.js (TypeScript) |
| - HTTP server (5000) |
| - IPC server         |
| - Expose JSON API    |
| - System info: wifi, battery |
+----------+-----------+
| 
IPC / HTTP
|
+----------v-----------+
| GTK 4 (C) frontend   |
| - Window "Desktop"   |
| - Fetch icon list / apps |
| - Draw grid/icons     |
| - Send user clicks via IPC |
``` +----------------------+
```

---

## 🧩 Step 1 — Node.js Server-Side

### 📦 Files

```
project/
├── src/
│   ├── server.ts
│   ├── ipc.ts
│   └── public/
│       └── index.html
├── package.json
├── tsconfig.json
└── start.sh
```

### **server.ts**

```ts
import express from 'express'
import path from 'path'
import { createServer } from 'http'
import { startIPCServer } from './ipc'
import os from 'os'

const app = express()
const PORT = 5000

// Serves the static folder (HTML / React build)
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/system', (req, res) => {
res.json({
battery: "80%",     // Simulated here
wifi: "Connected",
hostname: os.hostname(),
})
})

const server = createServer(app)
server.listen(PORT, () => {
console.log(`HTTP server running on http://localhost:${PORT}`)
})

startIPCServer()
```

### **ipc.ts**

```ts
import net from 'net'

export function startIPCServer() {
const socketPath = '/tmp/node-gtk.sock'
try { require('fs').unlinkSync(socketPath) } catch {}

const server = net.createServer((socket) => {
console.log('GTK connected via IPC')
socket.on('data', (data) => {
const message = data.toString().trim()
console.log('Received from GTK:', message)
if (message === 'get-status') {
socket.write(JSON.stringify({ battery: '78%', wifi: 'OK' }))
}
})
})

server.listen(socketPath, () => {
console.log('IPC server listening on', socketPath)
})
}
```

---

## 🖥️ Step 2 — GTK 4 Client-Side (C)

### **gtk_desktop.c**

```c
#include #include <gtk/gtk.h>
#include <gio/gio.h>
#include <stdio.h>
#include <json-c/json.h>

static GSocketConnection *connection;
static GOutputStream *out_stream;
static GInputStream *in_stream;

static void send_ipc_message(const char *msg) {
g_output_stream_write(out_stream, msg, strlen(msg), NULL, NULL);
}

static void refresh_status(GtkLabel *label) {
send_ipc_message("get-status\n"); 

char buffer[256]; 
gssize n = g_input_stream_read(in_stream, buffer, sizeof(buffer) - 1, NULL, NULL); 
buffer[n] = '\0'; 

struct json_object *json = json_tokener_parse(buffer); 
const char *battery = json_object_get_string(json_object_object_get(json, "battery")); 
const char *wifi = json_object_get_string(json_object_object_get(json, "wifi")); 

char text[128]; 
snprintf(text, sizeof(text), "Battery: %s | Wi-Fi: %s", battery, wifi); 
gtk_label_set_text(label, text); 

json_object_put(json);
}

static void activate(GtkApplication *app, gpointer user_data) {
GtkWidget *window = gtk_application_window_new(app); 
gtk_window_set_title(GTK_WINDOW(window), "Mini Desktop"); 
gtk_window_set_default_size(GTK_WINDOW(window), 400, 200); 

GtkWidget *label = gtk_label_new("Connecting..."); 
gtk_window_set_child(GTK_WINDOW(window), label); 
gtk_widget_show(window); 

// IPC connection
GSocketClient *client = g_socket_client_new(); 
GError *error = NULL; connection = g_socket_client_connect_to_uri(client, "unix:/tmp/node-gtk.sock", NULL, &error); 
if (!connection) {
gtk_label_set_text(label, "IPC connection failed"); 
return; 
}
out_stream = g_io_stream_get_output_stream(G_IO_STREAM(connection)); 
in_stream = g_io_stream_get_input_stream(G_IO_STREAM(connection)); 

refresh_status(GTK_LABEL(label));
}

int main(int argc, char **argv) {
GtkApplication *app; 
int status; 

app = gtk_application_new("com.example.desktop", G_APPLICATION_FLAGS_NONE); 
g_signal_connect(app, "activate", G_CALLBACK(activate), NULL); 
status = g_application_run(G_APPLICATION(app), argc, argv); 
g_object_unref(app); 
return status;
}
```

Compilation:

```bash
gcc gtk_desktop.c -o gtk_desktop `pkg-config --cflags --libs gtk4 json-c gio-2.0`
```

---

## ⚙️ Step 3 — Startup Script

### **start.sh**

```bash
#!/bin/bash
set -e
echo "Starting Node backend..."
node dist/server.js &
NODE_PID=$!

echo "Waiting 2 seconds for backend..."
sleep 2

echo "Launching GTK frontend..."
./gtk_desktop

kill $NODE_PID
echo "Shutdown complete."
```
---

## 🧠 Step 4 — Possible Extensions

* Add **React** to serve a parallel web UI on port 5000.
* Expose other IPC commands (open an app, display a notification, etc.).
* Manage the **actual battery** via `upower` or `acpi`.
* Manage the **actual Wi-Fi** via `nmcli` or `dbus`.
* Replace the IPC protocol with **D-Bus** for greater standardization.

---

## ✅ Expected Result

When you run:

```bash
./start.sh
```

➡️ Node starts (HTTP server + IPC)
➡️ GTK connects, reads `/tmp/node-gtk.sock`, and displays “Battery: 78% | Wi-Fi: OK”.

---

