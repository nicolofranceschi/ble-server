
# BLE Server for Wi-Fi Configuration

A Bluetooth Low Energy (BLE) server that allows Wi-Fi configuration via a mobile app.

## Running with Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/nicolofranceschi/ble-server.git
cd ble-server
```

2. Build and start the Docker container:
```bash
docker compose up -d --build
```

3. Check container status:
```bash
docker compose ps
docker logs ble-server
```

4. Stop the container:
```bash
docker compose down
```

### Prerequisites for Docker

- Docker and Docker Compose installed
- Bluetooth hardware on the host machine
- Host must be running Linux (Bluetooth passthrough doesn't work on macOS/Windows)

### Docker Permission Setup

If you encounter this error:
```
unable to get image: permission denied while trying to connect to the Docker daemon socket
```

You can either:

1. Run the provided permission script:
```bash
sudo ./fix-docker-permissions.sh
# Then either log out and back in, or run:
newgrp docker
```

2. Or manually add your user to the docker group:
```bash
# Add current user to docker group
sudo usermod -aG docker $USER

# Apply group changes (or log out and back in)
newgrp docker

# Verify docker works without sudo
docker ps
```

3. Or use sudo with docker commands:
```bash
sudo docker compose up -d --build
```

### Fixing Bluetooth Permissions

If you see `Bleno warning: adapter state unauthorized, please run as root or with sudo`, you need to set proper permissions:

1. For Docker setup, the Dockerfile already includes the necessary permission setup.

2. For manual installation, run the provided permission script:
```bash
sudo ./run-with-bluetooth-permissions.sh
```

This script will:
- Set capabilities on the node binary
- Add your user to the bluetooth group
- Set up udev rules for Bluetooth access
- Set proper ownership for Bluetooth directories

## Manual Installation (Alternative)

If you prefer to run without Docker:

1. Install dependencies:
```bash
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev libusb-1.0-0-dev jq network-manager
```

2. Install Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc  # or ~/.zshrc if using zsh
nvm install 20.18.0
```

3. Install npm dependencies:
```bash
npm install
```

4. Setup Bluetooth permissions:
```bash
# Give node binary capabilities to access Bluetooth without root
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

# Setup udev rules for Bluetooth access
echo 'SUBSYSTEM=="bluetooth", OWNER="$USER"' | sudo tee /etc/udev/rules.d/50-bluetooth-user.rules > /dev/null
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=bluetooth
```

5. Make start script executable:
```bash
chmod +x start_ble_server.sh
```

6. Run the application:
```bash
./start_ble_server.sh
```

## Systemd Service (Optional)

To run as a systemd service instead of Docker:

1. Copy the service file:
```bash
sudo cp ble_server.service /etc/systemd/system/
```

2. Edit the service file paths to match your installation:
```bash
sudo nano /etc/systemd/system/ble_server.service
```

3. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ble_server.service
sudo systemctl start ble_server.service
```

## Troubleshooting

### Docker Issues
- Make sure Docker is running with `--privileged` and `--net=host` (included in docker-compose.yml)
- Verify the host has Bluetooth hardware and it's not blocked: `rfkill list`
- Check container logs: `docker logs ble-server`
- If you see "Could not find any Python installation" error during build, the updated Dockerfile includes Python installation to fix this
- If you see "setcap: not found" error, the updated Dockerfile includes libcap2-bin to fix this
- If you see "group 'bluetooth' already exists" error, the updated Dockerfile handles existing groups/users

### Permissions Issues
- Make sure the caps are set correctly on node binary
- Verify the udev rules are properly installed
- Check that your user is in the `bluetooth` group: `sudo usermod -a -G bluetooth $USER`

### Logs
- Docker: `docker logs ble-server`
- Systemd: `sudo journalctl -u ble_server.service -f`

