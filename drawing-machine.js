var SerialPort = require("serialport");
var util = require("util");
var async = require("async");
var events = require("events");

var READY_CUE = "> ";

function Machine() {
  events.EventEmitter.call(this);
  this.commandOutputQueue = async.queue(this.sendCommand.bind(this), 1);
  this.commandOutputQueue.pause();
  this.drawingOutputQueue = async.queue(this.sendCommand.bind(this), 1);
  this.drawingOutputQueue.pause();
  this.currentResponse = "";
  this.machineConfig = {};
  this.machineIsConnected = false;
  this.activeQueue = this.commandOutputQueue;
  this.currentGcodeFile = "";
  this.currentLineNumber = 0;
  this.portList = [];
}

util.inherits(Machine, events.EventEmitter);

Machine.prototype.listPorts = function() {
  SerialPort.list(function (err, ports) {
    if (err) { console.log(err); }
    ports = ports.map(function(port){ return port.comName; });
    // put the most likely candidate first
    ports = ports.sort(function(a, b) {
      return b.indexOf("usbserial") - a.indexOf("usbserial");
    });
    this.portList = ports;
    this.emit("listedPorts", ports);
  }.bind(this));
};

Machine.prototype.connect = function(port) {
  this.serial = new SerialPort.SerialPort(port, {baudrate: 57600}, false); // false == do not open immediately
  this.serial.on('data', this._handleSerialData.bind(this));
  this.serial.open(function(err) {
    if (err) { console.log(err); }
    this.emit("connected");
    this.machineIsConnected = true;
    this.pushCommand("CONFIG");
  }.bind(this));
};

Machine.prototype.disconnect = function() {
  if (this.serial) {
    this.serial.close();
    this.emit("disconnected");
  }
};

Machine.prototype.pushCommand = function(command, lineNumber) {
  this.commandOutputQueue.push({command: command, line: lineNumber});
};

Machine.prototype.sendCommand = function(commandObject, callback) {
  var me = this;
  console.log("=====>", commandObject);
  this.serial.write(commandObject.command + ";", function(err, results) {
    if (err) { console.log(err); }
    me.activeQueue.pause();
    me.serial.drain(function() {
      me.emit("sentCommand", commandObject);
      if (commandObject.line) {
        me.currentLineNumber = commandObject.line;
      }
      callback();
    });
  });
};

Machine.prototype.loadGcodeFile = function(fileContents) {
  var me = this;
  this.currentGcodeFile = fileContents;
  this.emit("loadedGcodeFile", fileContents);
};

Machine.prototype.startDrawing = function() {
  this.currentLineNumber = 0;
  this.drawingOutputQueue.pause();
  this.commandOutputQueue.pause();
  this.currentGcodeFile.split("\n").forEach(function(command, line) {
    this.drawingOutputQueue.push({command: command, line: line});
  }.bind(this));
  this.activeQueue = this.drawingOutputQueue;
  this.drawingOutputQueue.resume();
  this.emit("startedDrawing");
};
Machine.prototype.resumeDrawing = function() {
  this.commandOutputQueue.pause();
  this.activeQueue = this.drawingOutputQueue;
  this.drawingOutputQueue.resume();
  this.emit("startedDrawing");
};
Machine.prototype.pauseDrawing = function() {
  this.drawingOutputQueue.pause();
  this.activeQueue = this.commandOutputQueue;
  this.commandOutputQueue.resume();
  this.emit("pausedDrawing");
};

Machine.prototype.isDrawing = function() {
  return !this.drawingOutputQueue.paused;
};

Machine.prototype.saveConfig = function(machineConfig) {
  var commandString = "CONFIG" +
    " W" + parseFloat(machineConfig.machineWidth).toFixed(3) +
    " H" + parseFloat(machineConfig.machineHeight).toFixed(3) +
    " ML" + // motor one "name"
    " NR" + // motor two "name"
    " O" + parseFloat(machineConfig.paperWidth).toFixed(3) +
    " P" + parseFloat(machineConfig.paperHeight).toFixed(3) +
    " Q" + parseFloat(machineConfig.leftSpoolDiameter).toFixed(3) +
    " R" + parseFloat(machineConfig.rightSpoolDiameter).toFixed(3) +
    " S" + parseInt(machineConfig.stepStyle) +
    " T" + parseInt(machineConfig.penUpAngle) +
    " U" + parseInt(machineConfig.penDownAngle) +
    " V" + parseInt(machineConfig.penDelay) +
    ";";
  this.pushCommand(commandString);
};

Machine.prototype._handleSerialData = function(data) {
  console.log(data.toString());
  this.currentResponse += data.toString();
  if (this.currentResponse.indexOf(READY_CUE) > -1) {
    this.currentResponse = this.currentResponse.split(READY_CUE)[0];
    this._parseResponse(this.currentResponse, function(err) {
      if (err) { console.log(err); }
      this.activeQueue.resume();
    }.bind(this));
    this.currentResponse = "";
  }
};

Machine.prototype._parseResponse = function(response, callback) {
  if (response.indexOf("CONFIG:") > -1) {
    this._loadConfig(response, callback);
  } else if (response.indexOf("RATE:") > -1) {
    console.log("RATE Not implemented!");
    callback(null);
    // this._loadRate(response, callback);
  } else if (response.indexOf("WHERE:") > -1) {
    this._loadWhere(response, callback);
  } else {
    callback(null);
  }
};

Machine.prototype._loadConfig = function(configString, callback) {
  var config = {};
  var lines = configString.split(":")[1].split("\n");
  console.log("loading config", configString);
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
    } else if (line.indexOf("S") === 0) {
      config.stepStyle = value;
    } else if (line.indexOf("T") === 0) {
      config.penUpAngle = value;
    } else if (line.indexOf("U") === 0) {
      config.penDownAngle = value;
    } else if (line.indexOf("V") === 0) {
      config.penDelay = value;
    }
  });
  this.machineConfig = config;
  this.emit("gotConfig", config);
  callback(null);
};

Machine.prototype._loadWhere = function(whereString, callback) {
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

module.exports = Machine;
