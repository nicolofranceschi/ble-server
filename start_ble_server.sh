#!/bin/bash

# Configure Bluetooth for container
echo "Configuring Bluetooth adapter..."
hciconfig hci0 up || echo "Warning: Failed to bring up Bluetooth adapter. If running in Docker, make sure --net=host and --privileged are set."

# Start the BLE server
echo "Starting BLE server..."
node server.js
