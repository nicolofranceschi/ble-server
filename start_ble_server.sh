#!/bin/bash

sudo hciconfig hci0 up
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
cd /usr/local/bin/ble
/home/box/.nvm/versions/node/v20.18.0/bin/node  server.js
