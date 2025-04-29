#!/bin/bash

# This script fixes Docker permissions by adding the current user
# to the docker group, allowing Docker commands without sudo

set -e

# Check if script is being run as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 
   exit 1
fi

# Get the user who should be added to the docker group
USER=${SUDO_USER:-$(whoami)}
if [ "$USER" == "root" ]; then
  echo "Warning: Running as root user directly. Cannot add root to docker group."
  exit 1
fi

# Check if the docker group exists
getent group docker > /dev/null || groupadd -r docker

# Add user to the docker group
usermod -aG docker $USER
echo "Added user $USER to docker group"

# Restart the Docker service to apply changes
systemctl restart docker
echo "Restarted Docker service"

echo ""
echo "Docker permissions have been set up for user $USER"
echo "You need to log out and log back in for these changes to take effect"
echo "Alternatively, run: newgrp docker"
echo ""
echo "To verify Docker works without sudo, run: docker ps"