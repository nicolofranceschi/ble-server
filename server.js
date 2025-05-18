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
        try {
            // Super simplified command to get ONLY wifi and ethernet connection status
            // This class is kept for backwards compatibility, but redirects to the same simplified logic
            const cmd = `sudo nmcli -t -f TYPE,STATE,CONNECTION device | grep -E "^(wifi|ethernet).*connected" | awk -F: '{print "{\"TYPE\":\"" $1 "\",\"STATE\":\"connected\",\"CONNECTION\":\"" $3 "\",\"CONNECTION_TYPE\":\"" $1 "\"}"}'`;
            
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Connection check error:`, error.message);
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }
                
                try {
                    // Construct a valid JSON array from the output
                    const lines = stdout.split('\n').filter(line => line.trim() !== '');
                    
                    if (lines.length === 0) {
                        // No connections
                        console.log('Connection check: No active connections');
                        const emptyResponse = JSON.stringify([]);
                        callback(this.RESULT_SUCCESS, Buffer.from(emptyResponse));
                        return;
                    }
                    
                    // Create the response as a valid JSON array
                    const jsonResponse = '[' + lines.join(',') + ']';
                    
                    // Log just once what we're sending
                    console.log(`Connection check: ${lines.length} active connections: ${lines.map(l => JSON.parse(l).TYPE).join(', ')}`);
                    
                    // Send the full response in one go
                    callback(this.RESULT_SUCCESS, Buffer.from(jsonResponse));
                } catch (e) {
                    console.error('Error processing connection data:', e.message);
                    callback(this.RESULT_UNLIKELY_ERROR);
                }
            });
        } catch (error) {
            console.error('Error parsing connection request:', error.message);
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
        console.log('Richiesta liste delle reti Wi-Fi', data.toString());

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
                
                const requestData = JSON.parse(data.toString());
                
                // Verifichiamo se è richiesto un indice specifico
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
                    
                    // Aggiungiamo un flag di refresh per forzare una nuova scansione se necessario
                    const shouldRefresh = requestData.refresh === true || networkIndex === 0;
                    
                    // Comando di scansione con timeout più lungo per reti più deboli
                    const scanCommand = shouldRefresh ? 
                        'sudo nmcli --wait 5 dev wifi rescan && sudo nmcli -f ssid,mode,chan,rate,signal,bars,security -t dev wifi' : 
                        'sudo nmcli -f ssid,mode,chan,rate,signal,bars,security -t dev wifi';
                    
                    console.log('Executing WiFi scan command:', scanCommand);
                    
                    // Scan per le reti Wi-Fi
                    exec(scanCommand, (nmcliErr, nmcliOut, nmcliStderr) => {
                        if (nmcliErr) {
                            console.error('ERROR with nmcli command:', nmcliErr);
                            console.error('STDERR:', nmcliStderr);
                            if (this._updateValueCallback) {
                                this._updateValueCallback(Buffer.from(`ERROR with nmcli: ${nmcliErr.message}`));
                            }
                            callback(this.RESULT_UNLIKELY_ERROR);
                            return;
                        }
                        
                        if (!nmcliOut || nmcliOut.trim() === '') {
                            console.warn('WARNING: nmcli returned empty output');
                            // Invia un segnale di fine lista anche se la risposta è vuota
                            const endBuffer = Buffer.from("end");
                            if (this._updateValueCallback) {
                                this._updateValueCallback(endBuffer);
                            }
                            callback(this.RESULT_SUCCESS, endBuffer);
                            return;
                        }
                        
                        // Scanning WiFi networks
                        console.log('Scanning WiFi networks...');
                        
                        // Reduced command to only get essential WiFi network data
                        const cmd = `sudo nmcli -f ssid,signal,security -t dev wifi | sudo jq -sR 'split("\\n") | map(select(length > 0)) | map(split(":")) | map(select(length >= 3)) | map({"network": .[0],"signal": .[1], "security": .[2]})'`;
                        
                        exec(cmd, (error, stdout, stderr) => {
                            if (error) {
                                console.error(`Error executing command: ${error}`);
                                if (this._updateValueCallback) {
                                    const message = `Error scanning WiFi networks: ${stderr}`;
                                    this._updateValueCallback(Buffer.from(message));
                                }
                                callback(this.RESULT_UNLIKELY_ERROR);
                                return;
                            }
                            
                            try {
                                // Verifica che l'output sia valido
                                if (!stdout || stdout.trim() === '') {
                                    console.log('No WiFi networks found');
                                    const endBuffer = Buffer.from("end");
                                    if (this._updateValueCallback) {
                                        this._updateValueCallback(endBuffer);
                                    }
                                    callback(this.RESULT_SUCCESS, endBuffer);
                                    return;
                                }
                                
                                // Parsing dell'array completo
                                const networks = JSON.parse(stdout);
                                
                                // Filtriamo le reti valide (con nome non vuoto)
                                const validNetworks = networks.filter(n => n && n.network && n.network.trim() !== '');
                                
                                // Ordiniamo per potenza del segnale
                                validNetworks.sort((a, b) => {
                                    const signalA = a.signal ? parseInt(a.signal) : 0;
                                    const signalB = b.signal ? parseInt(b.signal) : 0;
                                    return signalB - signalA; // Ordine decrescente
                                });
                                
                                // Log once with count instead of detailed info
                                console.log(`WiFi scan: ${validNetworks.length} networks, sending index ${networkIndex}`);
                                
                                // Accesso al network specifico
                                if (networkIndex < validNetworks.length) {
                                    const network = validNetworks[networkIndex];
                                    
                                    // Verifichiamo che il network abbia un nome valido
                                    if (!network.network || network.network.trim() === '') {
                                        const skipBuffer = Buffer.from(JSON.stringify({skip: true}));
                                        if (this._updateValueCallback) {
                                            this._updateValueCallback(skipBuffer);
                                        }
                                        callback(this.RESULT_SUCCESS, skipBuffer);
                                        return;
                                    }
                                    
                                    // Inviamo il singolo oggetto come JSON
                                    const responseData = JSON.stringify(network);
                                    const responseBuffer = Buffer.from(responseData);
                                    
                                    if (this._updateValueCallback) {
                                        this._updateValueCallback(responseBuffer);
                                    }
                                    
                                    callback(this.RESULT_SUCCESS, responseBuffer);
                                } else {
                                    // Nessun'altra rete disponibile
                                    const endBuffer = Buffer.from("end");
                                    
                                    if (this._updateValueCallback) {
                                        this._updateValueCallback(endBuffer);
                                    }
                                    
                                    callback(this.RESULT_SUCCESS, endBuffer);
                                }
                            } catch (parseError) {
                                console.error('Error parsing WiFi networks:', parseError);
                                if (this._updateValueCallback) {
                                    const message = 'Error parsing WiFi networks list';
                                    this._updateValueCallback(Buffer.from(message));
                                }
                                callback(this.RESULT_UNLIKELY_ERROR);
                            }
                        });
                    });
                } else {
                    // Vecchio modo - per retrocompatibilità
                    const offsetString = requestData.offset.replace(/'/g, "\\'");
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
                }
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

            // Simplified IP command
            const cmd = `hostname -I | awk '{print $1}'`;

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error getting IP: ${error}`);
                    if (this._updateValueCallback) {
                        const message = 'Error getting IP address';
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }

                // Get just the IP
                const ipAddress = stdout.trim();
                console.log(`IP Address: ${ipAddress}`);
                
                // Send response directly without chunking since IPs are small
                const responseBuffer = Buffer.from(ipAddress);
                
                if (this._updateValueCallback) {
                    this._updateValueCallback(responseBuffer);
                }

                callback(this.RESULT_SUCCESS, responseBuffer);
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
                
                // Direct approach to disconnect all wireless connections
                exec('sudo nmcli radio wifi off && sleep 1 && sudo nmcli radio wifi on', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Errore nella disconnessione Wi-Fi: ${error}`);
                        console.error(`STDERR: ${stderr}`);
                        
                        // Try fallback method if the radio command fails
                        exec('sudo nmcli -t -f DEVICE,TYPE,STATE device | grep wifi | grep connected', (checkErr, checkOut, checkStderr) => {
                            if (checkErr || !checkOut || checkOut.trim() === '') {
                                console.log('No connected wifi devices found or error checking');
                                if (this._updateValueCallback) {
                                    const message = 'Nessun dispositivo Wi-Fi connesso trovato o errore: ' + (checkStderr || stderr);
                                    this._updateValueCallback(Buffer.from(message));
                                }
                                callback(this.RESULT_UNLIKELY_ERROR);
                                return;
                            }
                            
                            // Parse the device name from the output
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
                            
                            // Extract device name and try to disconnect
                            const deviceName = devices[0].split(':')[0];
                            console.log(`Found connected wifi device: ${deviceName}, trying disconnect`);
                            
                            exec(`sudo nmcli device disconnect ${deviceName}`, (discErr, discOut, discStderr) => {
                                if (discErr) {
                                    console.error(`Error disconnecting device ${deviceName}: ${discErr}`);
                                    if (this._updateValueCallback) {
                                        const message = `Errore disconnettendo ${deviceName}: ${discStderr}`;
                                        this._updateValueCallback(Buffer.from(message));
                                    }
                                    callback(this.RESULT_UNLIKELY_ERROR);
                                } else {
                                    console.log(`Disconnected ${deviceName} successfully`);
                                    if (this._updateValueCallback) {
                                        const message = 'Disconnesso con successo dalla rete Wi-Fi';
                                        this._updateValueCallback(Buffer.from(message));
                                    }
                                    callback(this.RESULT_SUCCESS);
                                }
                            });
                        });
                        return;
                    }

                    console.log('Disconnesso dalla rete Wi-Fi con successo (radio method)');
                    
                    if (this._updateValueCallback) {
                        const message = 'Disconnesso con successo dalla rete Wi-Fi';
                        console.log('Sending success notification to client ->:', message);
                        this._updateValueCallback(Buffer.from(message));
                    }
                    callback(this.RESULT_SUCCESS);
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
        try {
            // Parse the input data just once
            const requestData = JSON.parse(data.toString());
            
            // Super simplified command to get ONLY wifi and ethernet connection status
            // Without checking jq separately and without extra logging
            const cmd = `sudo nmcli -t -f TYPE,STATE,CONNECTION device | grep -E "^(wifi|ethernet).*connected" | awk -F: '{print "{\"TYPE\":\"" $1 "\",\"STATE\":\"connected\",\"CONNECTION\":\"" $3 "\",\"CONNECTION_TYPE\":\"" $1 "\"}"}'`;
            
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error retrieving network info:`, error.message);
                    callback(this.RESULT_UNLIKELY_ERROR);
                    return;
                }
                
                try {
                    // Construct a valid JSON array from the output
                    const lines = stdout.split('\n').filter(line => line.trim() !== '');
                    
                    if (lines.length === 0) {
                        // No connections
                        console.log('Network status: No active connections');
                        const emptyResponse = JSON.stringify([]);
                        callback(this.RESULT_SUCCESS, Buffer.from(emptyResponse));
                        return;
                    }
                    
                    // Create the response as a valid JSON array
                    const jsonResponse = '[' + lines.join(',') + ']';
                    
                    // Log just once what we're sending
                    console.log(`Network status: ${lines.length} active connections: ${lines.map(l => JSON.parse(l).TYPE).join(', ')}`);
                    
                    // Send the full response in one go
                    callback(this.RESULT_SUCCESS, Buffer.from(jsonResponse));
                } catch (e) {
                    console.error('Error processing network info:', e.message);
                    callback(this.RESULT_UNLIKELY_ERROR);
                }
            });
        } catch (error) {
            console.error('Error parsing request:', error.message);
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