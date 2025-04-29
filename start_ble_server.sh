#!/bin/bash

# Configure Bluetooth for container
echo "Configuring Bluetooth adapter..."
# Try with and without sudo, depending on environment
if [ -x "$(command -v sudo)" ]; then
  sudo hciconfig hci0 up || echo "Warning: Failed to bring up Bluetooth adapter with sudo. The adapter may already be up."
else
  hciconfig hci0 up || echo "Warning: Failed to bring up Bluetooth adapter. If running in Docker, make sure --net=host and --privileged are set."
fi

# Start the BLE server
echo "Starting BLE server..."
node server.js
