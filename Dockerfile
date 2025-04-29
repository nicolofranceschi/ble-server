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
    python3 \
    python3-pip \
    build-essential \
    make \
    g++ \
    libcap2-bin \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set Python as the default for node-gyp
ENV PYTHON=/usr/bin/python3

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
RUN id -g bluetooth || groupadd -r bluetooth
RUN id -u bluetooth || useradd -r -g bluetooth bluetooth
RUN usermod -aG bluetooth bluetooth || true
# Add user to dialout for serial port access
RUN usermod -aG dialout bluetooth || true

# Set up udev rules for Bluetooth access
RUN echo 'SUBSYSTEM=="bluetooth", OWNER="bluetooth"' > /etc/udev/rules.d/50-bluetooth-user.rules

# Set appropriate ownership
RUN mkdir -p /var/run/bluetooth && \
    chown -R bluetooth:bluetooth /var/run/bluetooth

# Give the bluetooth user permission to the node binary location
RUN mkdir -p /app && chown -R bluetooth:bluetooth /app

# Switch to non-root user
USER bluetooth

# Set the entrypoint script
ENTRYPOINT ["./start_ble_server.sh"]

# Expose BLE (not needed for network ports but good documentation)
# BLE uses hardware directly, no TCP/UDP port needed