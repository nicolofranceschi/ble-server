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



        //nmcli -f ssid,mode,chan,rate,signal,bars,security -t dev wifi | jq -sR 'split("\n") | map(split(":")) | map({"network": .[0],"mode": .[1],"channel": .[2],"rate": .[3], "signal": .[4], "bars": .[5], "security": .[6]})' > wifi
        //nmcli -f TYPE,STATE -t d | jq -sR 'split("\n") | map(split(":")) | map({"TYPE": .[0],"STATE": .[1]})'

        try {

            const stepJson = JSON.parse(data.toString());

            const offsetString = stepJson.offset.replace(/'/g, "\\'");

            const offset = parseInt(offsetString);

            const cmd = `nmcli -f TYPE,STATE -t d | jq -sR 'split("\n") | map(split(":")) | map({"TYPE": .[0],"STATE": .[1]})'`;

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

            const stepJson = JSON.parse(data.toString());

            const offsetString = stepJson.offset.replace(/'/g, "\\'");

            const offset = parseInt(offsetString);

            const cmd = `nmcli -f ssid,mode,chan,rate,signal,bars,security -t dev wifi | jq -sR 'split("\n") | map(split(":")) | map({"network": .[0],"mode": .[1],"channel": .[2],"rate": .[3], "signal": .[4], "bars": .[5], "security": .[6]})'`;

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

            const cmd = `hostname -I | tr ' ' '\n' | grep -E '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01]))' | head -n 1`;

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

const wifiCharacteristic = new connectWifi();
const wifihandleConnection = new handleConnection();
const wifilistSSID = new listSSID()
const wifigetmyIp = new getIp()

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
                    wifigetmyIp
                ]
            })
        ]);
    }
});
