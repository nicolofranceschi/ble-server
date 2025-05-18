const bleno = require('@abandonware/bleno');
const exec = require('child_process').exec;

const BlenoPrimaryService = bleno.PrimaryService;
const BlenoCharacteristic = bleno.Characteristic;

class connectWifi extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
            properties: ['write', 'notify'], // Aggiunto 'notify' alle proprietà
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

            const ssid = wifiCredentials.username.replace(/'/g, "\\'");
            const password = wifiCredentials.password.replace(/'/g, "\\'");

            const cmd = `sudo nmcli device wifi connect '${ssid}' password '${password}'`;
            console.log('Executing Wi-Fi connect command (without showing password):', 
                         `sudo nmcli device wifi connect '${ssid}' password '********'`);

            exec(cmd, (error, stdout, stderr) => {

                if (error) {
                    console.error(`Errore nella connessione al Wi-Fi: ${error}`);
                    if (this._updateValueCallback) {
                        const message = 'Errore nella connessione al Wi-Fi' + stderr;
                        console.log('Sending error notification to client ->:', message);
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }

                console.log(`Connesso alla rete Wi-Fi: ${ssid}`);

                if (this._updateValueCallback) {
                    const message = 'Connesso con successo alla rete Wi-Fi' + stdout;
                    console.log('Sending success notification to client ->:', message);
                    this._updateValueCallback(Buffer.from(message));
                }
                callback("Connesso con successo alla rete Wi-Fi - from response");
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
            properties: ['write', 'notify'], // Aggiunto 'notify' alle proprietà
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
        console.log('Sono connesso ?', data.toString());

        try {
            // Debug: Check if jq is installed
            exec('which jq', (err, jqPath, stderr) => {
                if (err) {
                    console.error('ERROR: jq is not installed or not in PATH:', err);
                    if (this._updateValueCallback) {
                        this._updateValueCallback(Buffer.from('ERROR: jq command not found. Install with: apt-get install jq'));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }
                
                console.log('jq found at:', jqPath.trim());
                
                const stepJson = JSON.parse(data.toString());
                const offsetString = stepJson.offset.replace(/'/g, "\\'");
                const offset = parseInt(offsetString);

                // Debug: First run nmcli command separately to check output
                console.log('Executing network device status command...');
                exec('sudo nmcli -f TYPE,STATE -t d', (nmcliErr, nmcliOut, nmcliStderr) => {
                    if (nmcliErr) {
                        console.error('ERROR with nmcli command:', nmcliErr);
                        console.error('STDERR:', nmcliStderr);
                        if (this._updateValueCallback) {
                            this._updateValueCallback(Buffer.from(`ERROR with nmcli: ${nmcliErr.message}`));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }

                    console.log('Raw nmcli device status output:', nmcliOut);
                    
                    // Enhanced command to also report connection type (wifi vs ethernet)
                    const cmd = `sudo nmcli -f TYPE,STATE -t d | sudo jq -sR 'split("\\n") | map(split(":")) | map({"TYPE": .[0],"STATE": .[1], "CONNECTION_TYPE": (if .[0] == "ethernet" and .[1] == "connected" then "ethernet" elif .[0] == "wifi" and .[1] == "connected" then "wifi" else null end)})'`;
                    console.log('Executing full command with jq:', cmd);
                    
                    exec(cmd, (error, stdout, stderr) => {
                        console.log('Command completed with status:', error ? 'ERROR' : 'SUCCESS');
                        
                        if (error) {
                            console.error(`Error executing command: ${error}`);
                            console.error(`stderr: ${stderr}`);
                            if (this._updateValueCallback) {
                                const message = `Error checking network devices: ${stderr}`;
                                console.log('Sending error notification to client ->:', message);
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }

                        console.log('Raw jq output:', stdout);
                        
                        if (!stdout || stdout.trim() === '') {
                            console.error('WARNING: jq command returned empty output');
                        }
                        
                        const stringBase64 = Buffer.from(stdout);
                        const mtuSize = 20; // Assuming a typical MTU size minus some bytes for headers
                        const end = Math.min(offset + mtuSize, stringBase64.length);

                        const chunk = stringBase64.slice(offset, end);
                        console.log('Full data buffer length:', stringBase64.length);
                        console.log('Sending chunk:', chunk.toString());
                        console.log('Offset:', offset);
                        console.log('End:', end);
                        
                        if (this._updateValueCallback) {
                            console.log('Sending success notification to client ->:', chunk);
                            this._updateValueCallback(chunk);
                        }

                        callback(this.RESULT_SUCCESS, chunk);
                    });
                });
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

class listSSID extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff3',
            properties: ['write', 'notify'], // Aggiunto 'notify' alle proprietà
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
        console.log('Sono connesso ?', data.toString());

        try {
            // Debug: Check if jq is installed
            exec('which jq', (err, jqPath, stderr) => {
                if (err) {
                    console.error('ERROR: jq is not installed or not in PATH:', err);
                    if (this._updateValueCallback) {
                        this._updateValueCallback(Buffer.from('ERROR: jq command not found. Install with: apt-get install jq'));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }
                
                console.log('jq found at:', jqPath.trim());
                
                const stepJson = JSON.parse(data.toString());
                const offsetString = stepJson.offset.replace(/'/g, "\\'");
                const offset = parseInt(offsetString);

                // Debug: First run nmcli command separately to check output
                console.log('Executing WiFi scan command...');
                exec('sudo nmcli -f ssid,mode,chan,rate,signal,bars,security -t dev wifi', (nmcliErr, nmcliOut, nmcliStderr) => {
                    if (nmcliErr) {
                        console.error('ERROR with nmcli command:', nmcliErr);
                        console.error('STDERR:', nmcliStderr);
                        if (this._updateValueCallback) {
                            this._updateValueCallback(Buffer.from(`ERROR with nmcli: ${nmcliErr.message}`));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }

                    console.log('Raw nmcli output:', nmcliOut);
                    
                    // Now run the full command with jq
                    const cmd = `sudo nmcli -f ssid,mode,chan,rate,signal,bars,security -t dev wifi | sudo jq -sR 'split("\\n") | map(split(":")) | map({"network": .[0],"mode": .[1],"channel": .[2],"rate": .[3], "signal": .[4], "bars": .[5], "security": .[6]})'`;
                    console.log('Executing full command with jq:', cmd);
                    
                    exec(cmd, (error, stdout, stderr) => {
                        console.log('Command completed with status:', error ? 'ERROR' : 'SUCCESS');
                        
                        if (error) {
                            console.error(`Error executing command: ${error}`);
                            console.error(`stderr: ${stderr}`);
                            if (this._updateValueCallback) {
                                const message = `Error scanning WiFi networks: ${stderr}`;
                                console.log('Sending error notification to client ->:', message);
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }

                        console.log('Raw jq output:', stdout);
                        
                        if (!stdout || stdout.trim() === '') {
                            console.error('WARNING: jq command returned empty output');
                            if (this._updateValueCallback) {
                                const message = 'No WiFi networks found';
                                console.log('Sending notification to client ->:', message);
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }
                        
                        // Try to parse the JSON to validate it before sending
                        try {
                            const testParse = JSON.parse(stdout);
                            console.log(`Successfully parsed output with ${testParse.length} networks`);
                        } catch (parseError) {
                            console.error('Error parsing WiFi network data:', parseError);
                            // Continue anyway - the client will handle parsing issues
                        }
                        
                        const stringBase64 = Buffer.from(stdout);
                        const mtuSize = 20; // Assuming a typical MTU size minus some bytes for headers
                        const end = Math.min(offset + mtuSize, stringBase64.length);

                        const chunk = stringBase64.slice(offset, end);
                        console.log('Full data buffer length:', stringBase64.length);
                        console.log('Sending chunk:', chunk.toString());
                        console.log('Offset:', offset);
                        console.log('End:', end);
                        
                        if (this._updateValueCallback) {
                            console.log('Sending success notification to client ->:', chunk);
                            this._updateValueCallback(chunk);
                        }

                        callback(this.RESULT_SUCCESS, chunk);
                    });
                });
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

class getIp extends BlenoCharacteristic {
    constructor() {
        super({
            uuid: 'ffffffff-ffff-ffff-ffff-fffffffffff4',
            properties: ['write', 'notify'], // Aggiunto 'notify' alle proprietà
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

        console.log('Sono connesso ?', data.toString());

        try {

            const stepJson = JSON.parse(data.toString());

            const offsetString = stepJson.offset.replace(/'/g, "\\'");

            const offset = parseInt(offsetString);

            const cmd = `sudo hostname -I | tr ' ' '\n' | grep -E '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01]))' | head -n 1`;

            exec(cmd, (error, stdout, stderr) => {

                const stringBase64 = Buffer.from(stdout)
                const mtuSize = 20; // Assuming a typical MTU size minus some bytes for headers
                const end = Math.min(offset + mtuSize, stringBase64.length);

                const chunk = stringBase64.slice(offset, end);
                console.log(stringBase64)
                console.log(chunk)
                console.log(offset)
                console.log(end)
                
                if (error) {
                    console.error(`Errore nella connessione al Wi-Fi: ${error}`);
                    if (this._updateValueCallback) {
                        const message = 'Errore nella connessione al Wi-Fi' + stderr;
                        console.log('Sending error notification to client ->:', message);
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }

                if (this._updateValueCallback) {
                    const message = 'Connesso con successo alla rete Wi-Fi' + stdout;
                    console.log('Sending success notification to client ->:', chunk);
                    this._updateValueCallback(chunk);
                }

                callback(this.RESULT_SUCCESS, chunk);
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
                const ssid = changeRequest.ssid.replace(/'/g, "\\'");
                const password = changeRequest.password.replace(/'/g, "\\'");
                
                const cmd = `sudo nmcli device wifi connect '${ssid}' password '${password}'`;
                console.log('Executing Wi-Fi change command (without showing password):', 
                            `sudo nmcli device wifi connect '${ssid}' password '********'`);
                
                exec(cmd, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Errore nel cambio rete Wi-Fi: ${error}`);
                        console.error(`STDERR: ${stderr}`);
                        if (this._updateValueCallback) {
                            const message = 'Errore nel cambio rete Wi-Fi: ' + stderr;
                            console.log('Sending error notification to client ->:', message);
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }

                    console.log(`Connesso alla nuova rete Wi-Fi: ${ssid}`);
                    console.log(`STDOUT: ${stdout}`);
                    
                    if (this._updateValueCallback) {
                        const message = 'Connesso con successo alla nuova rete Wi-Fi: ' + stdout;
                        console.log('Sending success notification to client ->:', message);
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_SUCCESS);
                });
            } else if (changeRequest.action === 'disconnect') {
                // User wants to disconnect from current WiFi
                console.log('Executing Wi-Fi disconnect command');
                
                // Debug: First check which wifi device is connected
                exec('sudo nmcli -t -f DEVICE,TYPE,STATE device | grep wifi | grep connected', (checkErr, checkOut, checkStderr) => {
                    if (checkErr) {
                        console.error('Error checking for connected wifi devices:', checkErr);
                        if (this._updateValueCallback) {
                            const message = 'Errore nella ricerca dei dispositivi Wi-Fi connessi: ' + checkStderr;
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }
                    
                    // Parse the device name from the output (should be the first field)
                    const devices = checkOut.split('\n').filter(line => line.trim() !== '');
                    if (devices.length === 0) {
                        console.log('No connected wifi devices found');
                        if (this._updateValueCallback) {
                            const message = 'Nessun dispositivo Wi-Fi connesso trovato';
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_SUCCESS);
                        return;
                    }
                    
                    // Extract device name from first field (format is DEVICE:TYPE:STATE)
                    const deviceName = devices[0].split(':')[0];
                    console.log(`Found connected wifi device: ${deviceName}`);
                    
                    const cmd = `sudo nmcli device disconnect ${deviceName}`;
                    console.log('Executing command:', cmd);
                    
                    exec(cmd, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Errore nella disconnessione Wi-Fi: ${error}`);
                            console.error(`STDERR: ${stderr}`);
                            if (this._updateValueCallback) {
                                const message = 'Errore nella disconnessione Wi-Fi: ' + stderr;
                                console.log('Sending error notification to client ->:', message);
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }

                        console.log('Disconnesso dalla rete Wi-Fi');
                        console.log(`STDOUT: ${stdout}`);
                        
                        if (this._updateValueCallback) {
                            const message = 'Disconnesso con successo dalla rete Wi-Fi';
                            console.log('Sending success notification to client ->:', message);
                            this._updateValueCallback(Buffer.from(message));
                        }
                        callback(this.RESULT_SUCCESS);
                    });
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
            // Debug: Check if jq is installed
            exec('which jq', (err, jqPath, stderr) => {
                if (err) {
                    console.error('ERROR: jq is not installed or not in PATH:', err);
                    if (this._updateValueCallback) {
                        this._updateValueCallback(Buffer.from('ERROR: jq command not found. Install with: apt-get install jq'));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }
                
                console.log('jq found at:', jqPath.trim());
                
                const stepJson = JSON.parse(data.toString());
                const offsetString = stepJson.offset.replace(/'/g, "\\'");
                const offset = parseInt(offsetString);

                // Debug: First run nmcli command separately to check output
                console.log('Executing network info command...');
                exec('sudo nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device', (nmcliErr, nmcliOut, nmcliStderr) => {
                    if (nmcliErr) {
                        console.error('ERROR with nmcli command:', nmcliErr);
                        console.error('STDERR:', nmcliStderr);
                        if (this._updateValueCallback) {
                            this._updateValueCallback(Buffer.from(`ERROR with nmcli: ${nmcliErr.message}`));
                        }
                        callback(this.RESULT_UNLIKELY_ERROR);
                        return;
                    }

                    console.log('Raw nmcli device info output:', nmcliOut);
                    
                    // Command to get detailed network information
                    const cmd = `sudo nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device | sudo jq -sR 'split("\\n") | map(split(":")) | map({"DEVICE": .[0], "TYPE": .[1], "STATE": .[2], "CONNECTION": .[3], "CONNECTION_TYPE": (if .[1] == "ethernet" and .[2] == "connected" then "ethernet" elif .[1] == "wifi" and .[2] == "connected" then "wifi" else null end)})'`;
                    console.log('Executing full command with jq:', cmd);
                    
                    exec(cmd, (error, stdout, stderr) => {
                        console.log('Command completed with status:', error ? 'ERROR' : 'SUCCESS');
                        
                        if (error) {
                            console.error(`Error executing command: ${error}`);
                            console.error(`stderr: ${stderr}`);
                            if (this._updateValueCallback) {
                                const message = `Error retrieving network info: ${stderr}`;
                                console.log('Sending error notification to client ->:', message);
                                this._updateValueCallback(Buffer.from(message));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }

                        console.log('Raw jq output:', stdout);
                        
                        if (!stdout || stdout.trim() === '') {
                            console.error('WARNING: jq command returned empty output');
                        }
                        
                        const stringBase64 = Buffer.from(stdout);
                        const mtuSize = 20; // Assuming a typical MTU size minus some bytes for headers
                        const end = Math.min(offset + mtuSize, stringBase64.length);

                        const chunk = stringBase64.slice(offset, end);
                        console.log('Full data buffer length:', stringBase64.length);
                        console.log('Sending chunk:', chunk.toString());
                        console.log('Offset:', offset);
                        console.log('End:', end);
                        
                        if (this._updateValueCallback) {
                            console.log('Sending network info to client ->:', chunk);
                            this._updateValueCallback(chunk);
                        }

                        callback(this.RESULT_SUCCESS, chunk);
                    });
                });
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