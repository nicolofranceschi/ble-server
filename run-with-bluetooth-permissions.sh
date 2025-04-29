#!/bin/bash

# This script sets up proper permissions for Bluetooth access
# and runs the BLE server without root

set -e

# Check if script is being run as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 
   exit 1
fi

# Make sure Bluetooth interface is up
hciconfig hci0 up || echo "Failed to bring up Bluetooth adapter. Is it connected?"

# Set the proper capabilities for node
NODE_PATH=$(eval readlink -f `which node`)
echo "Setting capabilities for Node.js at $NODE_PATH"
setcap cap_net_raw+eip $NODE_PATH

# Check if the bluetooth group exists, if not create it
getent group bluetooth > /dev/null || groupadd -r bluetooth

# Make sure the current user is in the bluetooth group
USER=${SUDO_USER:-$(whoami)}
if [ "$USER" == "root" ]; then
  echo "Warning: Running as root. Can't add root to bluetooth group."
else
  usermod -a -G bluetooth $USER
  echo "Added user $USER to bluetooth group"
fi

# Set up udev rules for Bluetooth access
echo "Setting up udev rules for Bluetooth"
echo 'SUBSYSTEM=="bluetooth", OWNER="'"$USER"'"' > /etc/udev/rules.d/50-bluetooth-user.rules
udevadm control --reload-rules
udevadm trigger --subsystem-match=bluetooth

# Make sure the Bluetooth directory is accessible
mkdir -p /var/run/bluetooth
chown -R $USER:bluetooth /var/run/bluetooth

echo "Bluetooth permissions have been set up"
echo "You can now run the BLE server without root privileges"
echo "You may need to log out and log back in for group changes to take effect"