var SerialPort = require("serialport");
var util = require("util");
var async = require("async");
// var stream = require("stream");
var events = require("events");

var READY_CUE = "> ";

function GcodeSerial() {
  // stream.Writable.call(this);
  events.EventEmitter.call(this);
  this.commandOutputQueue = async.queue(this.sendCommand.bind(this), 1);
  this.commandOutputQueue.pause();
  this.currentResponse = "";
  this.machineConfig = {};
  this.machineIsConnected = false;
  this.currentGcodeFile = "";
}

// util.inherits(GcodeSerial, stream.Writable);
util.inherits(GcodeSerial, events.EventEmitter);

// GcodeSerial.prototype._write = function(chunk, encoding, callback) {
//   var me = this;
//   var stringEncoding = (encoding === 'buffer') ? null : encoding;
//   chunk.toString(stringEncoding).split("\n").forEach(function(line) {
//     me.commandOutputQueue.push(line);
//   });
//   callback();
// };

GcodeSerial.prototype.listPorts = function() {
  SerialPort.list(function (err, ports) {
    if (err) { console.log(err); }
    ports = ports.map(function(port){ return port.comName; });
    // put the most likely candidate first
    ports = ports.sort(function(a, b) {
      return b.indexOf("usbserial") - a.indexOf("usbserial");
    });
    this.emit("listedPorts", ports);
  }.bind(this));
};

GcodeSerial.prototype.connect = function(port) {
  this.serial = new SerialPort.SerialPort(port, {baudrate: 57600}, false); // false == do not open immediately
  this.serial.on('data', this._handleSerialData.bind(this));
  this.serial.open(function(err) {
    if (err) { console.log(err); }
    this.emit("connected");
    this.machineIsConnected = true;
    this.pushCommand("CONFIG");
  }.bind(this));
};

GcodeSerial.prototype.disconnect = function() {
  if (this.serial) {
    this.serial.close();
  }
};

GcodeSerial.prototype.pushCommand = function(command, lineNumber) {
  this.commandOutputQueue.push({command: command, line: lineNumber});
};

GcodeSerial.prototype.sendCommand = function(commandObject, callback) {
  var me = this;
  this.serial.write(commandObject.command + ";", function(err, results) {
    if (err) { console.log(err); }
    me.commandOutputQueue.pause();
    me.serial.drain(function() {
      me.emit("sentCommand", commandObject);
      callback();
    });
  });
};

GcodeSerial.prototype.loadGcodeFile = function(fileContents) {
  var me = this;
  this.currentGcodeFile = fileContents;
  fileContents.split("\n").forEach(function(command, line) {
    me.commandOutputQueue.push({command: command, line: line});
  });
};


GcodeSerial.prototype.saveConfig = function(machineConfig) {
  var commandString = "CONFIG" +
    " W" + parseFloat(machineConfig.machineWidth).toFixed(3) +
    " H" + parseFloat(machineConfig.machineHeight).toFixed(3) +
    " ML" + // motor one "name"
    " NR" + // motor two "name"
    " O" + parseFloat(machineConfig.paperWidth).toFixed(3) +
    " P" + parseFloat(machineConfig.paperHeight).toFixed(3) +
    " Q" + parseFloat(machineConfig.leftSpoolDiameter).toFixed(3) +
    " R" + parseFloat(machineConfig.rightSpoolDiameter).toFixed(3) +
    ";";
  this.pushCommand(commandString);
};

GcodeSerial.prototype._handleSerialData = function(data) {
  console.log(data.toString());
  this.currentResponse += data.toString();
  if (this.currentResponse.indexOf(READY_CUE) > -1) {
    this.currentResponse = this.currentResponse.split(READY_CUE)[0];
    this._parseResponse(this.currentResponse, function(err) {
      if (err) {
        console.log(err);
      }
      this.commandOutputQueue.resume();
    }.bind(this));
    // not totally sure if this creates or avoids a race condition...
    this.currentResponse = "";
  }
};

GcodeSerial.prototype._parseResponse = function(response, callback) {
  if (response.indexOf("CONFIG:") > -1) {
    this._loadConfig(response, callback);
  } else if (response.indexOf("RATE:")) {
    console.log("RATE Not implemented!");
    callback(null);
    // this._loadRate(response, callback);
  } else if (response.indexOf("WHERE:")) {
    this._loadWhere(response, callback);
  } else {
    callback(null);
  }
};

GcodeSerial.prototype._loadConfig = function(configString, callback) {
  var config = {};
  var lines = configString.split(":")[1].split("\n");
  lines.forEach(function(line) {
    var value = parseFloat(line.split("=")[1]);
    // TODO handle motor "names". from arduino src:
    // case 'M': _m1d=*(ptr+1); break;
    // case 'N': _m2d=*(ptr+1); break;
    if (line.indexOf("W") === 0) {
      config.machineWidth = value;
    } else if (line.indexOf("H") === 0) {
      config.machineHeight = value;
    } else if (line.indexOf("O") === 0) {
      config.paperWidth = value;
    } else if (line.indexOf("P") === 0) {
      config.paperHeight = value;
    } else if (line.indexOf("Q") === 0) {
      config.leftSpoolDiameter = value;
    } else if (line.indexOf("R") === 0) {
      config.rightSpoolDiameter = value;
    }
  });
  this.machineConfig = config;
  this.emit("gotConfig", config);
  callback(null);
};

GcodeSerial.prototype._loadWhere = function(whereString, callback) {
  var where = {};
  // WHERE:X0.00 Y0.00 Z0.00\n
  var parts = whereString.split(":")[1].split(" ");
  parts.forEach(function(part) {
    var value = parseFloat(part.substr(1));
    if (part.indexOf("X") === 0) {
      where.x = value;
    } else if (part.indexOf("Y") === 0) {
      where.y = value;
    } else if (part.indexOf("Z") === 0) {
      where.z = value;
    }
  });
  this.where = where;
  this.emit("gotWhere", where);
  callback(null);
};

module.exports = GcodeSerial;
