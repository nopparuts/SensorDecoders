/**
 * Payload Codec (Decoder + Encoder)
 *
 * Copyright 2025 Milesight IoT
 *
 * @product AT101
 */

var RAW_VALUE = 0x00;

/* eslint no-redeclare: "off" */
/* eslint-disable */

// ─── Chirpstack v4 ───────────────────────────────────────────────────────────
function decodeUplink(input) {
    return { data: milesightDeviceDecode(input.bytes) };
}
function encodeDownlink(input) {
    return { bytes: milesightDeviceEncode(input.data) };
}

// ─── Chirpstack v3 ───────────────────────────────────────────────────────────
function Decode(fPort, bytes) {
    return milesightDeviceDecode(bytes);
}
function Encode(fPort, obj) {
    return milesightDeviceEncode(obj);
}

// ─── The Things Network ──────────────────────────────────────────────────────
function Decoder(bytes, port) {
    return milesightDeviceDecode(bytes);
}
function Encoder(obj, port) {
    return milesightDeviceEncode(obj);
}

/* eslint-enable */

// ════════════════════════════════════════════════════════════════════════════
// SHARED MAPS
// ════════════════════════════════════════════════════════════════════════════

var YES_NO_MAP           = { 0: "no", 1: "yes" };
var ENABLE_MAP           = { 0: "disable", 1: "enable" };
var REPORT_STRATEGY_MAP  = { 0: "periodic", 1: "motion", 2: "timing" };
var POSITIONING_MAP      = { 0: "gnss", 1: "wifi", 2: "wifi_gnss" };
var WIFI_SCAN_MODE_MAP   = { 0: "low_power", 1: "high_accuracy" };
var LORAWAN_CLASS_MAP    = { 0: "Class A", 1: "Class B", 2: "Class C", 3: "Class CtoB" };
var MOTION_STATUS_MAP    = { 0: "unknown", 1: "start", 2: "moving", 3: "stop" };
var GEOFENCE_STATUS_MAP  = { 0: "inside", 1: "outside", 2: "unset", 3: "unknown" };
var DEVICE_POSITION_MAP  = { 0: "normal", 1: "tilt" };
var TAMPER_STATUS_MAP    = { 0: "install", 1: "uninstall" };
var TEMPERATURE_ALARM_MAP = { 0: "normal", 1: "abnormal" };
var TIMEZONE_MAP = {
    "-120": "UTC-12", "-110": "UTC-11", "-100": "UTC-10", "-95": "UTC-9:30",
    "-90": "UTC-9", "-80": "UTC-8", "-70": "UTC-7", "-60": "UTC-6",
    "-50": "UTC-5", "-40": "UTC-4", "-35": "UTC-3:30", "-30": "UTC-3",
    "-20": "UTC-2", "-10": "UTC-1", 0: "UTC",
    10: "UTC+1", 20: "UTC+2", 30: "UTC+3", 35: "UTC+3:30",
    40: "UTC+4", 45: "UTC+4:30", 50: "UTC+5", 55: "UTC+5:30",
    57: "UTC+5:45", 60: "UTC+6", 65: "UTC+6:30", 70: "UTC+7",
    80: "UTC+8", 90: "UTC+9", 95: "UTC+9:30", 100: "UTC+10",
    105: "UTC+10:30", 110: "UTC+11", 120: "UTC+12", 127: "UTC+12:45",
    130: "UTC+13", 140: "UTC+14"
};
var TIME_SYNC_ENABLE_MAP = { 0: "disable", 2: "enable" };

// ════════════════════════════════════════════════════════════════════════════
// DECODER
// ════════════════════════════════════════════════════════════════════════════

function milesightDeviceDecode(bytes) {
    var decoded = {};

    for (var i = 0; i < bytes.length; ) {
        var channel_id   = bytes[i++];
        var channel_type = bytes[i++];

        // IPSO VERSION
        if (channel_id === 0xff && channel_type === 0x01) {
            decoded.ipso_version = readProtocolVersion(bytes[i]);
            i += 1;
        }
        // HARDWARE VERSION
        else if (channel_id === 0xff && channel_type === 0x09) {
            decoded.hardware_version = readHardwareVersion(bytes.slice(i, i + 2));
            i += 2;
        }
        // FIRMWARE VERSION
        else if (channel_id === 0xff && channel_type === 0x0a) {
            decoded.firmware_version = readFirmwareVersion(bytes.slice(i, i + 2));
            i += 2;
        }
        // TSL VERSION
        else if (channel_id === 0xff && channel_type === 0xff) {
            decoded.tsl_version = readTslVersion(bytes.slice(i, i + 2));
            i += 2;
        }
        // SERIAL NUMBER
        else if (channel_id === 0xff && channel_type === 0x16) {
            decoded.sn = readSerialNumber(bytes.slice(i, i + 8));
            i += 8;
        }
        // LORAWAN CLASS TYPE
        else if (channel_id === 0xff && channel_type === 0x0f) {
            decoded.lorawan_class = getValueByKey(LORAWAN_CLASS_MAP, bytes[i]);
            i += 1;
        }
        // RESET EVENT
        else if (channel_id === 0xff && channel_type === 0xfe) {
            decoded.reset_event = getValueByKey({ 0: "normal", 1: "reset" }, 1);
            i += 1;
        }
        // DEVICE STATUS
        else if (channel_id === 0xff && channel_type === 0x0b) {
            decoded.device_status = getValueByKey({ 0: "off", 1: "on" }, 1);
            i += 1;
        }
        // BATTERY
        else if (channel_id === 0x01 && channel_type === 0x75) {
            decoded.battery = readUInt8(bytes[i]);
            i += 1;
        }
        // TEMPERATURE
        else if (channel_id === 0x03 && channel_type === 0x67) {
            decoded.temperature = readInt16LE(bytes.slice(i, i + 2)) / 10;
            i += 2;
        }
        // LOCATION
        else if ((channel_id === 0x04 || channel_id === 0x84) && channel_type === 0x88) {
            decoded.latitude  = readInt32LE(bytes.slice(i, i + 4)) / 1000000;
            decoded.longitude = readInt32LE(bytes.slice(i + 4, i + 8)) / 1000000;
            var status = bytes[i + 8];
            decoded.motion_status   = getValueByKey(MOTION_STATUS_MAP, status & 0x0f);
            decoded.geofence_status = getValueByKey(GEOFENCE_STATUS_MAP, status >> 4);
            i += 9;
        }
        // DEVICE POSITION
        else if (channel_id === 0x05 && channel_type === 0x00) {
            decoded.position = getValueByKey(DEVICE_POSITION_MAP, bytes[i]);
            i += 1;
        }
        // Wi-Fi SCAN RESULT
        else if (channel_id === 0x06 && channel_type === 0xd9) {
            var wifi = {};
            wifi.group         = readUInt8(bytes[i]);
            wifi.mac           = readMAC(bytes.slice(i + 1, i + 7));
            wifi.rssi          = readInt8(bytes[i + 7]);
            wifi.motion_status = getValueByKey(MOTION_STATUS_MAP, bytes[i + 8] & 0x0f);
            i += 9;
            decoded.wifi_scan_result = "finish";
            if (wifi.mac === "ff:ff:ff:ff:ff:ff") {
                decoded.wifi_scan_result = "timeout";
                continue;
            }
            decoded.motion_status = wifi.motion_status;
            decoded.wifi = decoded.wifi || [];
            decoded.wifi.push(wifi);
        }
        // TAMPER STATUS
        else if (channel_id === 0x07 && channel_type === 0x00) {
            decoded.tamper_status = getValueByKey(TAMPER_STATUS_MAP, bytes[i]);
            i += 1;
        }
        // TEMPERATURE WITH ABNORMAL
        else if (channel_id === 0x83 && channel_type === 0x67) {
            decoded.temperature       = readInt16LE(bytes.slice(i, i + 2)) / 10;
            decoded.temperature_alarm = getValueByKey(TEMPERATURE_ALARM_MAP, bytes[i + 2]);
            i += 3;
        }
        // HISTORICAL DATA
        else if (channel_id === 0x20 && channel_type === 0xce) {
            var location = {};
            location.timestamp = readUInt32LE(bytes.slice(i, i + 4));
            location.longitude = readInt32LE(bytes.slice(i + 4, i + 8)) / 1000000;
            location.latitude  = readInt32LE(bytes.slice(i + 8, i + 12)) / 1000000;
            i += 12;
            decoded.history = decoded.history || [];
            decoded.history.push(location);
        }
        // DOWNLINK RESPONSE
        else if (channel_id === 0xfe || channel_id === 0xff) {
            var result = handleDownlinkResponse(channel_type, bytes, i);
            decoded = Object.assign(decoded, result.data);
            i = result.offset;
        } else {
            break;
        }
    }

    return decoded;
}

function handleDownlinkResponse(channel_type, bytes, offset) {
    var decoded = {};

    switch (channel_type) {
        case 0x10:
            decoded.reboot = getValueByKey(YES_NO_MAP, 1);
            offset += 1;
            break;
        case 0x13:
            decoded.motion_report_config = {
                enable:   getValueByKey(ENABLE_MAP, readUInt8(bytes[offset])),
                interval: readUInt16LE(bytes.slice(offset + 1, offset + 3))
            };
            offset += 3;
            break;
        case 0x17:
            decoded.time_zone = getValueByKey(TIMEZONE_MAP, readInt16LE(bytes.slice(offset, offset + 2)));
            offset += 2;
            break;
        case 0x28:
            decoded.report_status = getValueByKey(YES_NO_MAP, 1);
            offset += 1;
            break;
        case 0x2d:
            decoded.wifi_positioning_config = {
                mode:         getValueByKey(WIFI_SCAN_MODE_MAP, readUInt8(bytes[offset])),
                num_of_bssid: readUInt8(bytes[offset + 1]),
                timeout:      readUInt8(bytes[offset + 2])
            };
            offset += 3;
            break;
        case 0x3b:
            decoded.time_sync_enable = getValueByKey(TIME_SYNC_ENABLE_MAP, readUInt8(bytes[offset]));
            offset += 1;
            break;
        case 0x3c:
            decoded.gnss_positioning_timeout = readUInt8(bytes[offset]);
            offset += 1;
            break;
        case 0x4a:
            decoded.sync_time = getValueByKey(YES_NO_MAP, 1);
            offset += 1;
            break;
        case 0x58:
            var det_type = readUInt8(bytes[offset]);
            var det_cfg  = {
                delta_g:  readUInt8(bytes[offset + 1]),
                duration: readUInt16LE(bytes.slice(offset + 2, offset + 4))
            };
            if (det_type === 0x00) decoded.motion_detection_config = det_cfg;
            else if (det_type === 0x01) decoded.static_detection_config = det_cfg;
            offset += 4;
            break;
        case 0x66:
            decoded.report_strategy = getValueByKey(REPORT_STRATEGY_MAP, readUInt8(bytes[offset]));
            offset += 1;
            break;
        case 0x71:
            decoded.positioning_strategy = getValueByKey(POSITIONING_MAP, readUInt8(bytes[offset]));
            offset += 1;
            break;
        case 0x7e:
            decoded.geofence_alarm_config = {
                enable:   getValueByKey(ENABLE_MAP, readUInt8(bytes[offset])),
                interval: readUInt16LE(bytes.slice(offset + 1, offset + 3)),
                counts:   readUInt8(bytes[offset + 3])
            };
            offset += 4;
            break;
        case 0x87:
            decoded.tamper_detection_enable = getValueByKey(ENABLE_MAP, readUInt8(bytes[offset]));
            offset += 1;
            break;
        case 0x88:
            decoded.geofence_center_config = decoded.geofence_center_config || {};
            decoded.geofence_center_config.latitude  = readInt32LE(bytes.slice(offset, offset + 4)) / 1000000;
            decoded.geofence_center_config.longitude = readInt32LE(bytes.slice(offset + 4, offset + 8)) / 1000000;
            offset += 8;
            break;
        case 0x89:
            decoded.geofence_center_config = decoded.geofence_center_config || {};
            decoded.geofence_center_config.radius = readUInt32LE(bytes.slice(offset, offset + 4));
            offset += 4;
            break;
        case 0x8a:
            var trc = {
                index: readUInt8(bytes[offset]) + 1,
                time:  readUInt16LE(bytes.slice(offset + 1, offset + 3))
            };
            decoded.timed_report_config = decoded.timed_report_config || [];
            decoded.timed_report_config.push(trc);
            offset += 3;
            break;
        case 0x8e:
            var rtype = readUInt8(bytes[offset]);
            var rval  = readUInt16LE(bytes.slice(offset + 1, offset + 3));
            if (rtype === 0x00) decoded.report_interval = rval;
            else if (rtype === 0x01) decoded.motion_report_interval = rval;
            offset += 3;
            break;
        case 0x8f:
            decoded.bluetooth_enable = getValueByKey(ENABLE_MAP, readUInt8(bytes[offset]));
            offset += 1;
            break;
        default:
            throw new Error("unknown downlink response: 0x" + channel_type.toString(16));
    }

    return { data: decoded, offset: offset };
}

// ════════════════════════════════════════════════════════════════════════════
// ENCODER
// ════════════════════════════════════════════════════════════════════════════

function milesightDeviceEncode(payload) {
    var encoded = [];

    if ("reboot" in payload)                   encoded = encoded.concat(reboot(payload.reboot));
    if ("report_status" in payload)            encoded = encoded.concat(reportStatus(payload.report_status));
    if ("time_zone" in payload)                encoded = encoded.concat(setTimeZone(payload.time_zone));
    if ("sync_time" in payload)                encoded = encoded.concat(syncTime(payload.sync_time));
    if ("report_interval" in payload)          encoded = encoded.concat(setReportInterval(payload.report_interval));
    if ("motion_report_interval" in payload)   encoded = encoded.concat(setMotionReportInterval(payload.motion_report_interval));
    if ("report_strategy" in payload)          encoded = encoded.concat(setReportStrategy(payload.report_strategy));
    if ("positioning_strategy" in payload)     encoded = encoded.concat(setPositioningStrategy(payload.positioning_strategy));
    if ("gnss_positioning_timeout" in payload) encoded = encoded.concat(setGNSSPositioningTimeout(payload.gnss_positioning_timeout));
    if ("wifi_positioning_config" in payload)  encoded = encoded.concat(setWifiPositioningConfig(payload.wifi_positioning_config));
    if ("motion_detection_config" in payload)  encoded = encoded.concat(setMotionDetectionConfig(payload.motion_detection_config));
    if ("static_detection_config" in payload)  encoded = encoded.concat(setStaticDetectionConfig(payload.static_detection_config));
    if ("motion_report_config" in payload)     encoded = encoded.concat(setMotionReportConfig(payload.motion_report_config));
    if ("geofence_center_config" in payload)   encoded = encoded.concat(setGeofenceCenterConfig(payload.geofence_center_config));
    if ("tamper_detection_enable" in payload)  encoded = encoded.concat(setTamperDetectionEnable(payload.tamper_detection_enable));
    if ("geofence_alarm_config" in payload)    encoded = encoded.concat(setGeofenceAlarmConfig(payload.geofence_alarm_config));
    if ("timed_report_config" in payload) {
        for (var i = 0; i < payload.timed_report_config.length; i++) {
            encoded = encoded.concat(setTimedReportConfig(payload.timed_report_config[i]));
        }
    }
    if ("bluetooth_enable" in payload)  encoded = encoded.concat(setBlueToothEnable(payload.bluetooth_enable));
    if ("time_sync_enable" in payload)  encoded = encoded.concat(setTimeSyncEnable(payload.time_sync_enable));

    return encoded;
}

/** @example { "reboot": 1 } */
function reboot(reboot) {
    mustBeOneOf("reboot", reboot, YES_NO_MAP);
    if (getKeyByValue(YES_NO_MAP, reboot) === 0) return [];
    return [0xff, 0x10, 0xff];
}

/** @example { "report_status": 1 } */
function reportStatus(report_status) {
    mustBeOneOf("report_status", report_status, YES_NO_MAP);
    if (getKeyByValue(YES_NO_MAP, report_status) === 0) return [];
    return [0xff, 0x28, 0xff];
}

/** @example { "time_zone": "UTC+7" } */
function setTimeZone(time_zone) {
    mustBeOneOf("time_zone", time_zone, TIMEZONE_MAP);
    var buf = new Buffer(4);
    buf.writeUInt8(0xff);
    buf.writeUInt8(0x17);
    buf.writeInt16LE(getKeyByValue(TIMEZONE_MAP, time_zone));
    return buf.toBytes();
}

/** @example { "sync_time": 1 } */
function syncTime(sync_time) {
    mustBeOneOf("sync_time", sync_time, YES_NO_MAP);
    if (getKeyByValue(YES_NO_MAP, sync_time) === 0) return [];
    return [0xff, 0x4a, 0x00];
}

/** @example { "report_interval": 20 } */
function setReportInterval(report_interval) {
    if (report_interval < 1 || report_interval > 1440) throw new Error("report_interval must be between 1 and 1440");
    var buf = new Buffer(5);
    buf.writeUInt8(0xff); buf.writeUInt8(0x8e); buf.writeUInt8(0x00); buf.writeUInt16LE(report_interval);
    return buf.toBytes();
}

/** @example { "motion_report_interval": 20 } */
function setMotionReportInterval(motion_report_interval) {
    if (motion_report_interval < 1 || motion_report_interval > 1440) throw new Error("motion_report_interval must be between 1 and 1440");
    var buf = new Buffer(5);
    buf.writeUInt8(0xff); buf.writeUInt8(0x8e); buf.writeUInt8(0x01); buf.writeUInt16LE(motion_report_interval);
    return buf.toBytes();
}

/** @example { "report_strategy": "motion" } */
function setReportStrategy(report_strategy) {
    mustBeOneOf("report_strategy", report_strategy, REPORT_STRATEGY_MAP);
    var buf = new Buffer(3);
    buf.writeUInt8(0xff); buf.writeUInt8(0x66); buf.writeUInt8(getKeyByValue(REPORT_STRATEGY_MAP, report_strategy));
    return buf.toBytes();
}

/** @example { "positioning_strategy": "wifi" } */
function setPositioningStrategy(positioning_strategy) {
    mustBeOneOf("positioning_strategy", positioning_strategy, POSITIONING_MAP);
    var buf = new Buffer(3);
    buf.writeUInt8(0xff); buf.writeUInt8(0x71); buf.writeUInt8(getKeyByValue(POSITIONING_MAP, positioning_strategy));
    return buf.toBytes();
}

/** @example { "gnss_positioning_timeout": 3 } */
function setGNSSPositioningTimeout(timeout) {
    if (timeout < 1 || timeout > 5) throw new Error("gnss_positioning_timeout must be between 1 and 5");
    var buf = new Buffer(3);
    buf.writeUInt8(0xff); buf.writeUInt8(0x3c); buf.writeUInt8(timeout);
    return buf.toBytes();
}

/** @example { "wifi_positioning_config": { "mode": "low_power", "num_of_bssid": 10, "timeout": 2 } } */
function setWifiPositioningConfig(cfg) {
    mustBeOneOf("wifi_positioning_config.mode", cfg.mode, WIFI_SCAN_MODE_MAP);
    var buf = new Buffer(5);
    buf.writeUInt8(0xff); buf.writeUInt8(0x2d);
    buf.writeUInt8(getKeyByValue(WIFI_SCAN_MODE_MAP, cfg.mode));
    buf.writeUInt8(cfg.num_of_bssid);
    buf.writeUInt8(cfg.timeout);
    return buf.toBytes();
}

/** @example { "motion_detection_config": { "delta_g": 1, "duration": 60 } } */
function setMotionDetectionConfig(cfg) {
    if (cfg.duration < 1 || cfg.duration > 60) throw new Error("motion_detection_config.duration must be between 1 and 60");
    var buf = new Buffer(6);
    buf.writeUInt8(0xff); buf.writeUInt8(0x58); buf.writeUInt8(0x00);
    buf.writeUInt8(cfg.delta_g); buf.writeUInt16LE(cfg.duration);
    return buf.toBytes();
}

/** @example { "static_detection_config": { "delta_g": 1, "duration": 600 } } */
function setStaticDetectionConfig(cfg) {
    if (cfg.duration < 1 || cfg.duration > 1800) throw new Error("static_detection_config.duration must be between 1 and 1800");
    var buf = new Buffer(6);
    buf.writeUInt8(0xff); buf.writeUInt8(0x58); buf.writeUInt8(0x01);
    buf.writeUInt8(cfg.delta_g); buf.writeUInt16LE(cfg.duration);
    return buf.toBytes();
}

/** @example { "motion_report_config": { "enable": "enable", "interval": 20 } } */
function setMotionReportConfig(cfg) {
    mustBeOneOf("motion_report_config.enable", cfg.enable, ENABLE_MAP);
    if (cfg.interval < 1 || cfg.interval > 1440) throw new Error("motion_report_config.interval must be between 1 and 1440");
    var buf = new Buffer(5);
    buf.writeUInt8(0xff); buf.writeUInt8(0x13);
    buf.writeUInt8(getKeyByValue(ENABLE_MAP, cfg.enable)); buf.writeUInt16LE(cfg.interval);
    return buf.toBytes();
}

/** @example { "geofence_center_config": { "latitude": 39.9087, "longitude": 116.3975, "radius": 10 } } */
function setGeofenceCenterConfig(cfg) {
    var data = [];
    if ("latitude" in cfg && "longitude" in cfg) {
        var buf = new Buffer(10);
        buf.writeUInt8(0xff); buf.writeUInt8(0x88);
        buf.writeInt32LE(cfg.latitude * 1000000);
        buf.writeInt32LE(cfg.longitude * 1000000);
        data = data.concat(buf.toBytes());
    }
    if ("radius" in cfg) {
        var buf2 = new Buffer(6);
        buf2.writeUInt8(0xff); buf2.writeUInt8(0x89);
        buf2.writeUInt32LE(cfg.radius);
        data = data.concat(buf2.toBytes());
    }
    return data;
}

/** @example { "tamper_detection_enable": "enable" } */
function setTamperDetectionEnable(val) {
    mustBeOneOf("tamper_detection_enable", val, ENABLE_MAP);
    var buf = new Buffer(3);
    buf.writeUInt8(0xff); buf.writeUInt8(0x87); buf.writeUInt8(getKeyByValue(ENABLE_MAP, val));
    return buf.toBytes();
}

/** @example { "geofence_alarm_config": { "enable": "enable", "interval": 20, "counts": 1 } } */
function setGeofenceAlarmConfig(cfg) {
    mustBeOneOf("geofence_alarm_config.enable", cfg.enable, ENABLE_MAP);
    if (cfg.interval < 1 || cfg.interval > 1440) throw new Error("geofence_alarm_config.interval must be between 1 and 1440");
    if (cfg.counts < 1 || cfg.counts > 3)        throw new Error("geofence_alarm_config.counts must be between 1 and 3");
    var buf = new Buffer(6);
    buf.writeUInt8(0xff); buf.writeUInt8(0x7e);
    buf.writeUInt8(getKeyByValue(ENABLE_MAP, cfg.enable));
    buf.writeUInt16LE(cfg.interval); buf.writeUInt8(cfg.counts);
    return buf.toBytes();
}

/** @example { "timed_report_config": [{ "index": 1, "time": 60 }] } */
function setTimedReportConfig(cfg) {
    if (cfg.index < 1 || cfg.index > 5) throw new Error("timed_report_config.index must be between 1 and 5");
    var buf = new Buffer(5);
    buf.writeUInt8(0xff); buf.writeUInt8(0x8a);
    buf.writeUInt8(cfg.index - 1); buf.writeUInt16LE(cfg.time);
    return buf.toBytes();
}

/** @example { "bluetooth_enable": "enable" } */
function setBlueToothEnable(val) {
    mustBeOneOf("bluetooth_enable", val, ENABLE_MAP);
    var buf = new Buffer(3);
    buf.writeUInt8(0xff); buf.writeUInt8(0x8f); buf.writeUInt8(getKeyByValue(ENABLE_MAP, val));
    return buf.toBytes();
}

/** @example { "time_sync_enable": "enable" } */
function setTimeSyncEnable(val) {
    mustBeOneOf("time_sync_enable", val, TIME_SYNC_ENABLE_MAP);
    var buf = new Buffer(3);
    buf.writeUInt8(0xff); buf.writeUInt8(0x3b); buf.writeUInt8(getKeyByValue(TIME_SYNC_ENABLE_MAP, val));
    return buf.toBytes();
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/** Decoder: look up a display value from a numeric key */
function getValueByKey(map, key) {
    if (RAW_VALUE) return key;
    var val = map[key];
    return val !== undefined ? val : "unknown";
}

/** Encoder: look up a numeric key from a display value */
function getKeyByValue(map, value) {
    if (RAW_VALUE) return value;
    for (var key in map) {
        if (map[key] === value) return parseInt(key);
    }
    throw new Error("value '" + value + "' not found in " + JSON.stringify(map));
}

/** Validate encoder input is one of the allowed map values */
function mustBeOneOf(field, value, map) {
    var allowed = [];
    for (var k in map) allowed.push(RAW_VALUE ? parseInt(k) : map[k]);
    if (allowed.indexOf(value) === -1) {
        throw new Error(field + " must be one of: " + allowed.join(", "));
    }
}

function readProtocolVersion(bytes) {
    return "v" + ((bytes & 0xf0) >> 4) + "." + (bytes & 0x0f);
}
function readHardwareVersion(bytes) {
    return "v" + (bytes[0] & 0xff).toString(16) + "." + ((bytes[1] & 0xff) >> 4);
}
function readFirmwareVersion(bytes) {
    return "v" + (bytes[0] & 0xff).toString(16) + "." + (bytes[1] & 0xff).toString(16);
}
function readTslVersion(bytes) {
    return "v" + (bytes[0] & 0xff) + "." + (bytes[1] & 0xff);
}
function readSerialNumber(bytes) {
    var tmp = [];
    for (var i = 0; i < bytes.length; i++) tmp.push(("0" + (bytes[i] & 0xff).toString(16)).slice(-2));
    return tmp.join("");
}
function readMAC(bytes) {
    var tmp = [];
    for (var i = 0; i < bytes.length; i++) tmp.push(("0" + (bytes[i] & 0xff).toString(16)).slice(-2));
    return tmp.join(":");
}
function readUInt8(b)      { return b & 0xff; }
function readInt8(b)       { var r = readUInt8(b); return r > 0x7f ? r - 0x100 : r; }
function readUInt16LE(b)   { return ((b[1] << 8) + b[0]) & 0xffff; }
function readInt16LE(b)    { var r = readUInt16LE(b); return r > 0x7fff ? r - 0x10000 : r; }
function readUInt32LE(b)   { return ((b[3] << 24) + (b[2] << 16) + (b[1] << 8) + b[0]) >>> 0; }
function readInt32LE(b)    { var r = readUInt32LE(b); return r > 0x7fffffff ? r - 0x100000000 : r; }

// ════════════════════════════════════════════════════════════════════════════
// BUFFER (encoder helper)
// ════════════════════════════════════════════════════════════════════════════

function Buffer(size) {
    this.buffer = new Array(size);
    this.offset = 0;
    for (var i = 0; i < size; i++) this.buffer[i] = 0;
}
Buffer.prototype._write = function (value, byteLen, le) {
    for (var i = 0; i < byteLen; i++) {
        var shift = le ? i << 3 : (byteLen - 1 - i) << 3;
        this.buffer[this.offset + i] = (value >> shift) & 0xff;
    }
};
Buffer.prototype.writeUInt8    = function (v) { this._write(v, 1, true);  this.offset += 1; };
Buffer.prototype.writeInt8     = function (v) { this._write(v < 0 ? v + 0x100 : v, 1, true); this.offset += 1; };
Buffer.prototype.writeUInt16LE = function (v) { this._write(v, 2, true);  this.offset += 2; };
Buffer.prototype.writeInt16LE  = function (v) { this._write(v < 0 ? v + 0x10000 : v, 2, true); this.offset += 2; };
Buffer.prototype.writeUInt24LE = function (v) { this._write(v, 3, true);  this.offset += 3; };
Buffer.prototype.writeInt24LE  = function (v) { this._write(v < 0 ? v + 0x1000000 : v, 3, true); this.offset += 3; };
Buffer.prototype.writeUInt32LE = function (v) { this._write(v, 4, true);  this.offset += 4; };
Buffer.prototype.writeInt32LE  = function (v) { this._write(v < 0 ? v + 0x100000000 : v, 4, true); this.offset += 4; };
Buffer.prototype.toBytes       = function ()  { return this.buffer; };
