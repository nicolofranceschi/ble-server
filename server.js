const bleno = require('@abandonware/bleno');
const utils = require('./utils');

const BlenoPrimaryService = bleno.PrimaryService;
const BlenoCharacteristic = bleno.Characteristic;

class connectWifi extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
            properties: ['write', 'notify'],
            value: null
        });

        this._value = Buffer.alloc(0);
        this._updateValueCallback = null;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('Client sottoscritto alle notifiche');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('Client annullato sottoscrizione alle notifiche');
        this._updateValueCallback = null;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        console.log('Ricevute credenziali Wi-Fi:', data.toString());

        try {
            const wifiCredentials = JSON.parse(data.toString());
            const ssid = wifiCredentials.username;
            const password = wifiCredentials.password;

            // Use the utility function to connect to WiFi
            utils.connectToWifi(ssid, password)
                .then(result => {
                    if (result.error) {
                        console.error(`Errore nella connessione al Wi-Fi: ${result.error}`);
                        if (this._updateValueCallback) {
                            const message = 'Errore nella connessione al Wi-Fi' + result.stderr;
                            console.log('Sending error notification to client ->:', message);
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }

                    console.log(`Connesso alla rete Wi-Fi: ${ssid}`);

                    if (this._updateValueCallback) {
                        const message = 'Connesso con successo alla rete Wi-Fi' + result.stdout;
                        console.log('Sending success notification to client ->:', message);
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback("Connesso con successo alla rete Wi-Fi - from response");
                })
                .catch(error => {
                    console.error(`Errore nella connessione al Wi-Fi: ${error}`);
                    if (this._updateValueCallback) {
                        const message = 'Errore nella connessione al Wi-Fi: ' + error.message;
                        console.log('Sending error notification to client ->:', message);
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                });
        } catch (error) {
            console.error('Impossibile analizzare le credenziali Wi-Fi:', error);
            if (this._updateValueCallback) {
                const message = 'Errore nel parsing delle credenziali';
                console.log('Sending error notification to client ->:', message);
                this._updateValueCallback(Buffer.from(message));
            }
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}

class handleConnection extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff2',
            properties: ['write', 'notify'],
            value: null
        });

        this._value = Buffer.alloc(0);
        this._updateValueCallback = null;
        this._cachedData = null;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('Client sottoscritto alle notifiche');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('Client annullato sottoscrizione alle notifiche');
        this._updateValueCallback = null;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        console.log('Sono connesso ?', data.toString());

        try {
            // First check if jq is installed
            utils.checkJqInstalled()
                .then(jqInstalled => {
                    if (!jqInstalled) {
                        console.error('ERROR: jq is not installed or not in PATH');
                        if (this._updateValueCallback) {
                            this._updateValueCallback(Buffer.from('ERROR: jq command not found. Install with: apt-get install jq'));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }

                    const stepJson = JSON.parse(data.toString());
                    const offsetString = stepJson.offset.replace(/'/g, "\\'");
                    const offset = parseInt(offsetString);

                    // If offset is 0, we need to fetch fresh data or use very recent cache
                    const forceRefresh = offset === 0;

                    // Use the utility function to get network information
                    utils.getNetworkInfo({ forceRefresh })
                        .then(networkInfo => {
                            // Cache the response as JSON string
                            const jsonResponse = JSON.stringify(networkInfo);
                            this._cachedData = Buffer.from(jsonResponse);

                            // Get appropriate chunk
                            const chunk = utils.getChunk(this._cachedData, offset);
                            
                            console.log('Full data buffer length:', this._cachedData.length);
                            console.log('Sending chunk:', chunk.toString());
                            console.log('Offset:', offset);
                            console.log('End:', offset + chunk.length);
                            
                            if (this._updateValueCallback) {
                                console.log('Sending success notification to client ->:', chunk);
                                this._updateValueCallback(chunk);
                            }

                            callback(this.RESULT_SUCCESS, chunk);
                        })
                        .catch(error => {
                            console.error(`Error getting network info: ${error}`);
                            if (this._updateValueCallback) {
                                const message = `Error checking network devices: ${error.message}`;
                                console.log('Sending error notification to client ->:', message);
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                        });
                })
                .catch(error => {
                    console.error(`Error checking jq installation: ${error}`);
                    if (this._updateValueCallback) {
                        const message = `Error in prerequisites check: ${error.message}`;
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                });
        } catch (error) {
            console.error('Impossibile analizzare la richiesta:', error);
            if (this._updateValueCallback) {
                const message = 'Errore nel parsing della richiesta';
                console.log('Sending error notification to client ->:', message);
                this._updateValueCallback(Buffer.from(message));
            }
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}

class listSSID extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff3',
            properties: ['write', 'notify'],
            value: null
        });

        this._value = Buffer.alloc(0);
        this._updateValueCallback = null;
        this._cachedNetworks = null;
        this._lastScanTime = 0;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('Client sottoscritto alle notifiche');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('Client annullato sottoscrizione alle notifiche');
        this._updateValueCallback = null;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        console.log('Richiesta liste delle reti Wi-Fi', data.toString());

        try {
            // First check if jq is installed
            utils.checkJqInstalled()
                .then(jqInstalled => {
                    if (!jqInstalled) {
                        console.error('ERROR: jq is not installed or not in PATH');
                        if (this._updateValueCallback) {
                            this._updateValueCallback(Buffer.from('ERROR: jq command not found. Install with: apt-get install jq'));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }

                    const requestData = JSON.parse(data.toString());

                    // Handle the index-based request (newer approach)
                    if ('index' in requestData) {
                        let networkIndex;
                        
                        try {
                            networkIndex = parseInt(requestData.index);
                            console.log(`Requested network at index: ${networkIndex}`);
                            
                            if (isNaN(networkIndex)) {
                                throw new Error("Invalid network index");
                            }
                        } catch (indexError) {
                            console.error('Error parsing network index:', indexError);
                            if (this._updateValueCallback) {
                                this._updateValueCallback(Buffer.from('Invalid network index format'));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }
                        
                        // Force a fresh scan if requested or if this is the first network request
                        const shouldRefresh = requestData.refresh === true || networkIndex === 0;
                        const now = Date.now();
                        const timeSinceLastScan = now - this._lastScanTime;
                        
                        // Get networks, with scan if needed
                        utils.getWifiNetworks({ 
                            scan: shouldRefresh && timeSinceLastScan > 10000, // Scan if requested and > 10 seconds since last scan
                            forceRefresh: shouldRefresh,
                            ttl: 30000 // 30 seconds cache for WiFi list
                        })
                            .then(networks => {
                                // Update the cache and scan timestamp
                                this._cachedNetworks = networks;
                                if (shouldRefresh && timeSinceLastScan > 10000) {
                                    this._lastScanTime = now;
                                }
                                
                                console.log(`WiFi scan: ${networks.length} networks, sending index ${networkIndex}`);
                                
                                // Check if the requested network exists
                                if (networkIndex < networks.length) {
                                    const network = networks[networkIndex];
                                    
                                    // Verify the network has a valid name
                                    if (!network.network || network.network.trim() === '') {
                                        const skipBuffer = Buffer.from(JSON.stringify({skip: true}));
                                        if (this._updateValueCallback) {
                                            this._updateValueCallback(skipBuffer);
                                        }
                                        callback(this.RESULT_SUCCESS, skipBuffer);
                                        return;
                                    }
                                    
                                    // Send the single network as JSON
                                    const responseData = JSON.stringify(network);
                                    const responseBuffer = Buffer.from(responseData);
                                    
                                    if (this._updateValueCallback) {
                                        this._updateValueCallback(responseBuffer);
                                    }
                                    
                                    callback(this.RESULT_SUCCESS, responseBuffer);
                                } else {
                                    // No more networks available
                                    const endBuffer = Buffer.from("end");
                                    
                                    if (this._updateValueCallback) {
                                        this._updateValueCallback(endBuffer);
                                    }
                                    
                                    callback(this.RESULT_SUCCESS, endBuffer);
                                }
                            })
                            .catch(error => {
                                console.error(`Error getting WiFi networks: ${error}`);
                                if (this._updateValueCallback) {
                                    const message = `Error scanning WiFi networks: ${error.message}`;
                                    this._updateValueCallback(Buffer.from(message));
                                }
                                callback(this.RESULT_UNLIKELY_ERROR);
                            });
                    } else {
                        // Legacy chunked approach
                        const offsetString = requestData.offset.replace(/'/g, "\\'");
                        const offset = parseInt(offsetString);
                        
                        // We need fresh data if offset is 0
                        const forceRefresh = offset === 0;
                        
                        // Get networks, with scan if needed
                        utils.getWifiNetworks({ 
                            scan: forceRefresh,
                            forceRefresh,
                            ttl: 30000 // 30 seconds cache for WiFi list
                        })
                            .then(networks => {
                                // Update cache and scan timestamp if this is a fresh request
                                if (forceRefresh) {
                                    this._cachedNetworks = networks;
                                    this._lastScanTime = Date.now();
                                }
                                
                                // Prepare the full response as JSON string
                                const jsonResponse = JSON.stringify(networks);
                                const responseBuffer = Buffer.from(jsonResponse);
                                
                                // Get the appropriate chunk
                                const chunk = utils.getChunk(responseBuffer, offset);
                                
                                console.log('Full data buffer length:', responseBuffer.length);
                                console.log('Sending chunk:', chunk.toString());
                                console.log('Offset:', offset);
                                console.log('End:', offset + chunk.length);
                                
                                if (this._updateValueCallback) {
                                    console.log('Sending success notification to client ->:', chunk);
                                    this._updateValueCallback(chunk);
                                }

                                callback(this.RESULT_SUCCESS, chunk);
                            })
                            .catch(error => {
                                console.error(`Error getting WiFi networks: ${error}`);
                                if (this._updateValueCallback) {
                                    const message = `Error scanning WiFi networks: ${error.message}`;
                                    console.log('Sending error notification to client ->:', message);
                                    this._updateValueCallback(Buffer.from(message));
                                }
                                callback(this.RESULT_UNLIKELY_ERROR);
                            });
                    }
                })
                .catch(error => {
                    console.error(`Error checking jq installation: ${error}`);
                    if (this._updateValueCallback) {
                        const message = `Error in prerequisites check: ${error.message}`;
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                });
        } catch (error) {
            console.error('Impossibile analizzare la richiesta:', error);
            if (this._updateValueCallback) {
                const message = 'Errore nel parsing della richiesta';
                console.log('Sending error notification to client ->:', message);
                this._updateValueCallback(Buffer.from(message));
            }
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}

class getIp extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff4',
            properties: ['write', 'notify'],
            value: null
        });

        this._value = Buffer.alloc(0);
        this._updateValueCallback = null;
        this._cachedIp = null;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('Client sottoscritto alle notifiche');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('Client annullato sottoscrizione alle notifiche');
        this._updateValueCallback = null;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        console.log('Richiesta indirizzo IP', data.toString());

        try {
            // Use the utility function to get IP address
            utils.getIpAddress()
                .then(ipAddress => {
                    console.log(`IP Address: ${ipAddress}`);
                    
                    // Cache the IP
                    this._cachedIp = ipAddress;
                    
                    // Send response directly (small enough not to need chunking)
                    const responseBuffer = Buffer.from(ipAddress);
                    
                    if (this._updateValueCallback) {
                        this._updateValueCallback(responseBuffer);
                    }

                    callback(this.RESULT_SUCCESS, responseBuffer);
                })
                .catch(error => {
                    console.error(`Error getting IP: ${error}`);
                    if (this._updateValueCallback) {
                        const message = 'Error getting IP address';
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                });
        } catch (error) {
            console.error('Impossibile analizzare la richiesta IP:', error);
            if (this._updateValueCallback) {
                const message = 'Errore nel parsing della richiesta';
                console.log('Sending error notification to client ->:', message);
                this._updateValueCallback(Buffer.from(message));
            }
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}

class changeWifi extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff5',
            properties: ['write', 'notify'],
            value: null
        });

        this._value = Buffer.alloc(0);
        this._updateValueCallback = null;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('Client sottoscritto alle notifiche');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('Client annullato sottoscrizione alle notifiche');
        this._updateValueCallback = null;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        console.log('Changing Wi-Fi network:', data.toString());

        try {
            const changeRequest = JSON.parse(data.toString());
            
            if (changeRequest.action === 'change') {
                // User wants to change to a different WiFi network
                const ssid = changeRequest.ssid;
                const password = changeRequest.password;
                
                // Use the utility function to connect to WiFi
                utils.connectToWifi(ssid, password)
                    .then(result => {
                        if (result.error) {
                            console.error(`Errore nel cambio rete Wi-Fi: ${result.error}`);
                            console.error(`STDERR: ${result.stderr}`);
                            if (this._updateValueCallback) {
                                const message = 'Errore nel cambio rete Wi-Fi: ' + result.stderr;
                                console.log('Sending error notification to client ->:', message);
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }

                        console.log(`Connesso alla nuova rete Wi-Fi: ${ssid}`);
                        console.log(`STDOUT: ${result.stdout}`);
                        
                        if (this._updateValueCallback) {
                            const message = 'Connesso con successo alla nuova rete Wi-Fi: ' + result.stdout;
                            console.log('Sending success notification to client ->:', message);
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_SUCCESS);
                    })
                    .catch(error => {
                        console.error(`Error connecting to WiFi: ${error}`);
                        if (this._updateValueCallback) {
                            const message = `Error connecting to WiFi: ${error.message}`;
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                    });
            } else if (changeRequest.action === 'disconnect') {
                // User wants to disconnect from current WiFi
                console.log('Executing Wi-Fi disconnect command');
                
                // Use the utility function to disconnect from WiFi
                utils.disconnectWifi()
                    .then(result => {
                        if (result.error) {
                            console.error(`Errore nella disconnessione Wi-Fi: ${result.error}`);
                            console.error(`STDERR: ${result.stderr}`);
                            if (this._updateValueCallback) {
                                const message = 'Errore nella disconnessione Wi-Fi: ' + result.stderr;
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }

                        console.log('Disconnesso dalla rete Wi-Fi con successo');
                        
                        if (this._updateValueCallback) {
                            const message = 'Disconnesso con successo dalla rete Wi-Fi';
                            console.log('Sending success notification to client ->:', message);
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_SUCCESS);
                    })
                    .catch(error => {
                        console.error(`Error disconnecting from WiFi: ${error}`);
                        if (this._updateValueCallback) {
                            const message = `Error disconnecting from WiFi: ${error.message}`;
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                    });
            } else {
                console.error('Azione non supportata');
                if (this._updateValueCallback) {
                    const message = 'Azione non supportata';
                    console.log('Sending error notification to client ->:', message);
                    this._updateValueCallback(Buffer.from(message));
                }
                callback(this.RESULT_UNLIKELY_ERROR);
            }
        } catch (error) {
            console.error('Impossibile analizzare la richiesta:', error);
            if (this._updateValueCallback) {
                const message = 'Errore nel parsing della richiesta';
                console.log('Sending error notification to client ->:', message);
                this._updateValueCallback(Buffer.from(message));
            }
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}

class getNetworkInfo extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff6',
            properties: ['write', 'notify'],
            value: null
        });

        this._value = Buffer.alloc(0);
        this._updateValueCallback = null;
        this._cachedData = null;
    }

    onSubscribe(maxValueSize, updateValueCallback) {
        console.log('Client sottoscritto alle notifiche');
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe() {
        console.log('Client annullato sottoscrizione alle notifiche');
        this._updateValueCallback = null;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        console.log('Requested network information', data.toString());

        try {
            // First check if jq is installed
            utils.checkJqInstalled()
                .then(jqInstalled => {
                    if (!jqInstalled) {
                        console.error('ERROR: jq is not installed or not in PATH');
                        if (this._updateValueCallback) {
                            this._updateValueCallback(Buffer.from('ERROR: jq command not found. Install with: apt-get install jq'));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }

                    const stepJson = JSON.parse(data.toString());
                    const offsetString = stepJson.offset.replace(/'/g, "\\'");
                    const offset = parseInt(offsetString);

                    // If offset is 0, we need to fetch fresh data or use very recent cache
                    const forceRefresh = offset === 0;

                    // Use the utility function to get network information
                    utils.getNetworkInfo({ forceRefresh })
                        .then(networkInfo => {
                            // Process data to make it even smaller if needed
                            const minimizedResponse = networkInfo.map(device => ({
                                TYPE: device.TYPE,
                                STATE: "connected",
                                CONNECTION: device.CONNECTION || device.TYPE,
                                CONNECTION_TYPE: device.TYPE
                            }));
                            
                            // Cache the response as JSON string
                            const jsonResponse = JSON.stringify(minimizedResponse);
                            this._cachedData = Buffer.from(jsonResponse);

                            // Send entire response if possible, otherwise chunk it
                            if (this._cachedData.length <= 20 || offset >= this._cachedData.length) {
                                if (this._updateValueCallback) {
                                    this._updateValueCallback(this._cachedData);
                                }
                                callback(this.RESULT_SUCCESS, this._cachedData);
                            } else {
                                // Get appropriate chunk
                                const chunk = utils.getChunk(this._cachedData, offset);
                                
                                console.log('Full data buffer length:', this._cachedData.length);
                                console.log('Sending chunk:', chunk.toString());
                                console.log('Offset:', offset);
                                console.log('End:', offset + chunk.length);
                                
                                if (this._updateValueCallback) {
                                    this._updateValueCallback(chunk);
                                }
                                callback(this.RESULT_SUCCESS, chunk);
                            }
                        })
                        .catch(error => {
                            console.error(`Error getting network info: ${error}`);
                            if (this._updateValueCallback) {
                                const message = `Error retrieving network info: ${error.message}`;
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                        });
                })
                .catch(error => {
                    console.error(`Error checking jq installation: ${error}`);
                    if (this._updateValueCallback) {
                        const message = `Error in prerequisites check: ${error.message}`;
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                });
        } catch (error) {
            console.error('Impossibile analizzare la richiesta:', error);
            if (this._updateValueCallback) {
                const message = 'Errore nel parsing della richiesta';
                console.log('Sending error notification to client ->:', message);
                this._updateValueCallback(Buffer.from(message));
            }
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}

const wifiCharacteristic = new connectWifi();
const wifihandleConnection = new handleConnection();
const wifilistSSID = new listSSID();
const wifigetmyIp = new getIp();
const wifiChangeNetwork = new changeWifi();
const wifiNetworkInfo = new getNetworkInfo();

bleno.on('stateChange', (state) => {
    console.log('Stato Bluetooth: ' + state);
    if (state === 'poweredOn') {
        bleno.startAdvertising('WiFiSetup', ['ffffffff-ffff-ffff-ffff-fffffffffff0']);
    } else if (state === 'unauthorized') {
        console.error('Bluetooth adapter state unauthorized. Please check permissions:');
        console.error('1. Run with proper capabilities: sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)');
        console.error('2. Or use the provided script: sudo ./run-with-bluetooth-permissions.sh');
        console.error('See README.md for detailed instructions');
    } else {
        bleno.stopAdvertising();
    }
});

bleno.on('advertisingStart', (error) => {
    console.log('Avvio advertising: ' + (error ? 'errore ' + error : 'successo'));
    if (!error) {
        bleno.setServices([
            new BlenoPrimaryService({
                uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff0',
                characteristics: [
                    wifiCharacteristic,
                    wifihandleConnection,
                    wifilistSSID,
                    wifigetmyIp,
                    wifiChangeNetwork,
                    wifiNetworkInfo
                ]
            })
        ]);
    }
});