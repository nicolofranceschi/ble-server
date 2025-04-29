FROM node:20.18.0-slim

# Install required dependencies
RUN apt-get update && apt-get install -y \
    bluetooth \
    bluez \
    libbluetooth-dev \
    libudev-dev \
    libusb-1.0-0-dev \
    jq \
    net-tools \
    network-manager \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy app source
COPY . .

# Make start script executable
RUN chmod +x start_ble_server.sh

# Set capabilities for node binary to access Bluetooth
RUN setcap cap_net_raw+eip $(eval readlink -f `which node`)

# Create a non-root user for running the application
RUN groupadd -r bluetooth && \
    useradd -r -g bluetooth bluetooth && \
    usermod -aG bluetooth bluetooth

# Set up udev rules for Bluetooth access
RUN echo 'SUBSYSTEM=="bluetooth", OWNER="bluetooth"' > /etc/udev/rules.d/50-bluetooth-user.rules

# Set appropriate ownership
RUN mkdir -p /var/run/bluetooth && \
    chown -R bluetooth:bluetooth /var/run/bluetooth

# Switch to non-root user
USER bluetooth

# Set the entrypoint script
ENTRYPOINT ["./start_ble_server.sh"]

# Expose BLE (not needed for network ports but good documentation)
# BLE uses hardware directly, no TCP/UDP port needed