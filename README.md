

git clone 

sudo visudo
#add to bottom
box  ALL=(ALL) NOPASSWD: ALL

sudo systemctl stop bluetooth
sudo systemctl disable bluetooth

sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev libusb-1.0-0-dev

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
# download and install Node.js (you may need to restart the terminal)
nvm install 20.18.0
# verifies the right Node.js version is in the environment
node -v # should print `v22.11.0`
# verifies the right npm version is in the environment
npm -v # should print `10.9.0

npm i

mv ble /usr/local/bin/ble

nano /etc/systemd/system/ble_server.service 

sudo systemctl start  ble_server.service
sudo systemctl status  ble_server.service
sudo systemctl restart  ble_server.service
sudo cat /var/log/syslog


