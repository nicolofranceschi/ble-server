/**
 * Utility functions for the IntelligenceBox server
 * This module provides caching and command execution to improve performance
 */

const exec = require('child_process').exec;

// Cache for command results to avoid re-executing the same commands
const commandCache = {
    // Maps command strings to their execution results
    results: new Map(),
    // Maps command strings to their expiration timestamp
    expiry: new Map(),
    // Default TTL for cache entries (in milliseconds)
    defaultTTL: 10000 // 10 seconds
};

/**
 * Executes a command with caching
 * If the command has been executed recently, returns the cached result
 * Otherwise, executes the command and caches the result
 * 
 * @param {string} cmd - The command to execute
 * @param {Object} options - Options for execution and caching
 * @param {number} options.ttl - Time to live in ms for the cache entry (default: 10000)
 * @param {boolean} options.forceRefresh - Force refresh the cache even if a valid entry exists
 * @returns {Promise<{error: Error|null, stdout: string, stderr: string}>} - The execution result
 */
function executeWithCache(cmd, options = {}) {
    const ttl = options.ttl || commandCache.defaultTTL;
    const forceRefresh = options.forceRefresh || false;
    const now = Date.now();

    // Check if we have a valid cached result
    if (!forceRefresh && commandCache.results.has(cmd)) {
        const expiry = commandCache.expiry.get(cmd);
        
        // Return cached result if it's still valid
        if (expiry && now < expiry) {
            console.log(`Using cached result for command: ${cmd.substring(0, 40)}...`);
            return Promise.resolve(commandCache.results.get(cmd));
        }
    }

    // Execute the command and cache the result
    return new Promise((resolve, reject) => {
        console.log(`Executing command: ${cmd.substring(0, 40)}...`);
        
        exec(cmd, (error, stdout, stderr) => {
            const result = { error, stdout, stderr };
            
            // Cache the result
            commandCache.results.set(cmd, result);
            commandCache.expiry.set(cmd, now + ttl);
            
            resolve(result);
        });
    });
}

/**
 * Get network connection information with caching
 * 
 * @param {Object} options - Options for execution and caching
 * @returns {Promise<Object>} - Parsed network information
 */
async function getNetworkInfo(options = {}) {
    // Command to get network information (more efficient than running multiple commands)
    const cmd = `sudo nmcli -t -f TYPE,STATE,CONNECTION device | grep connected | sudo jq -sR 'split("\\n") | map(select(length > 0)) | map(split(":")) | map({TYPE: .[0], STATE: .[1], CONNECTION: .[2]}) | map(select(.TYPE == "wifi" or .TYPE == "ethernet"))'`;
    
    const result = await executeWithCache(cmd, options);
    
    if (result.error) {
        console.error(`Error getting network info: ${result.error}`);
        throw result.error;
    }
    
    try {
        // Parse the JSON result
        const networkInfo = JSON.parse(result.stdout);
        
        // Process the data to ensure consistent format
        return networkInfo.map(device => ({
            TYPE: device.TYPE,
            STATE: "connected",
            CONNECTION: device.CONNECTION || device.TYPE,
            CONNECTION_TYPE: device.TYPE
        }));
    } catch (e) {
        console.error(`Error parsing network info: ${e}`);
        throw e;
    }
}

/**
 * Get WiFi network list with caching
 * 
 * @param {Object} options - Options for execution and caching
 * @returns {Promise<Object>} - Parsed WiFi network list
 */
async function getWifiNetworks(options = {}) {
    // If a scan is requested, run the scan command without caching
    if (options.scan) {
        try {
            await executeWithCache('sudo nmcli --wait 5 dev wifi rescan', { forceRefresh: true });
        } catch (e) {
            console.error(`Error scanning WiFi networks: ${e}`);
            // Continue anyway, as we might still get results from the current scan
        }
    }
    
    // Command to get WiFi networks
    const cmd = `sudo nmcli -f ssid,mode,chan,rate,signal,bars,security -t dev wifi | sudo jq -sR 'split("\\n") | map(split(":")) | map({"network": .[0],"mode": .[1],"channel": .[2],"rate": .[3], "signal": .[4], "bars": .[5], "security": .[6]})'`;
    
    const result = await executeWithCache(cmd, options);
    
    if (result.error) {
        console.error(`Error getting WiFi networks: ${result.error}`);
        throw result.error;
    }
    
    try {
        // Parse the JSON result
        const networks = JSON.parse(result.stdout);
        
        // Filter for valid networks
        const validNetworks = networks.filter(n => n && n.network && n.network.trim() !== '');
        
        // Sort by signal strength
        return validNetworks.sort((a, b) => {
            const signalA = a.signal ? parseInt(a.signal) : 0;
            const signalB = b.signal ? parseInt(b.signal) : 0;
            return signalB - signalA; // Descending order
        });
    } catch (e) {
        console.error(`Error parsing WiFi network list: ${e}`);
        throw e;
    }
}

/**
 * Get IP address with caching
 * 
 * @param {Object} options - Options for execution and caching
 * @returns {Promise<string>} - IP address
 */
async function getIpAddress(options = {}) {
    const cmd = `hostname -I | awk '{print $1}'`;
    
    const result = await executeWithCache(cmd, options);
    
    if (result.error) {
        console.error(`Error getting IP address: ${result.error}`);
        throw result.error;
    }
    
    return result.stdout.trim();
}

/**
 * Connect to a WiFi network (no caching)
 * 
 * @param {string} ssid - WiFi network name
 * @param {string} password - WiFi password
 * @returns {Promise<{error: Error|null, stdout: string, stderr: string}>} - Connection result
 */
function connectToWifi(ssid, password) {
    const escapedSsid = ssid.replace(/'/g, "\\'");
    const escapedPassword = password.replace(/'/g, "\\'");
    
    const cmd = `sudo nmcli device wifi connect '${escapedSsid}' password '${escapedPassword}'`;
    
    console.log('Executing WiFi connect command (without showing password):', 
                `sudo nmcli device wifi connect '${escapedSsid}' password '********'`);
    
    // This command is not cached
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            resolve({ error, stdout, stderr });
        });
    });
}

/**
 * Disconnect from WiFi (no caching)
 * 
 * @returns {Promise<{error: Error|null, stdout: string, stderr: string}>} - Disconnection result
 */
function disconnectWifi() {
    const cmd = 'sudo nmcli radio wifi off && sleep 1 && sudo nmcli radio wifi on';
    
    // This command is not cached
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                // Try fallback method if the radio command fails
                exec('sudo nmcli -t -f DEVICE,TYPE,STATE device | grep wifi | grep connected', (checkErr, checkOut, checkStderr) => {
                    if (checkErr || !checkOut || checkOut.trim() === '') {
                        resolve({ error, stdout, stderr });
                        return;
                    }
                    
                    // Parse the device name from the output
                    const devices = checkOut.split('\n').filter(line => line.trim() !== '');
                    if (devices.length === 0) {
                        resolve({ error, stdout, stderr });
                        return;
                    }
                    
                    // Extract device name and try to disconnect
                    const deviceName = devices[0].split(':')[0];
                    console.log(`Found connected wifi device: ${deviceName}, trying disconnect`);
                    
                    exec(`sudo nmcli device disconnect ${deviceName}`, (discErr, discOut, discStderr) => {
                        resolve({ 
                            error: discErr, 
                            stdout: discOut,
                            stderr: discStderr
                        });
                    });
                });
            } else {
                resolve({ error, stdout, stderr });
            }
        });
    });
}

/**
 * Chunk a buffer or string into smaller pieces for BLE transmission
 * 
 * @param {Buffer|string} data - Data to chunk
 * @param {number} offset - Starting position for the chunk
 * @param {number} chunkSize - Maximum size of each chunk (default: 20 bytes)
 * @returns {Buffer} - The chunk of data
 */
function getChunk(data, offset, chunkSize = 20) {
    // Ensure data is a Buffer
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    // Calculate chunk boundaries
    const end = Math.min(offset + chunkSize, buffer.length);
    
    // Return the chunk
    return buffer.slice(offset, end);
}

/**
 * Check if the node system has jq installed
 * 
 * @returns {Promise<boolean>} - Whether jq is installed
 */
async function checkJqInstalled() {
    try {
        const result = await executeWithCache('which jq', { ttl: 3600000 }); // Cache for 1 hour
        return !result.error && result.stdout.trim() !== '';
    } catch (e) {
        return false;
    }
}

module.exports = {
    executeWithCache,
    getNetworkInfo,
    getWifiNetworks,
    getIpAddress,
    connectToWifi,
    disconnectWifi,
    getChunk,
    checkJqInstalled
};