var SerialPort = require("serialport");
var util = require("util");
var async = require("async");
var stream = require("stream");
var events = require("events");

var READY_CUE = "> ";

function GcodeSerial() {
  stream.Writable.call(this);
  events.EventEmitter.call(this);
  this.commandOutputQueue = async.queue(this.sendCommand.bind(this), 1);
  this.commandOutputQueue.pause();
  this.currentResponse = "";
  this.lastCommand = "";
  this.machineConfig = {};
}

util.inherits(GcodeSerial, stream.Writable);
util.inherits(GcodeSerial, events.EventEmitter);

GcodeSerial.prototype._write = function(chunk, encoding, callback) {
  var me = this;
  var stringEncoding = (encoding === 'buffer') ? null : encoding;
  chunk.toString(stringEncoding).split("\n").forEach(function(line) {
    me.commandOutputQueue.push(line);
  });
  callback();
};

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
  // var me = this;
  this.serial = new SerialPort.SerialPort(port, {baudrate: 57600}, false); // false == do not open immediately
  this.serial.on('data', this._handleSerialData.bind(this));
  this.serial.open(function(err) {
    if (err) { console.log(err); } 
    this.emit("connected");
    this.pushCommand("CONFIG");
  }.bind(this));
};

GcodeSerial.prototype.pushCommand = function(command) {
  this.commandOutputQueue.push(command);
};

GcodeSerial.prototype.sendCommand = function(command, callback) {
  var me = this;
  this.serial.write(command + ";", function(err, results) {
    if (err) { console.log(err); }
    me.lastCommand = command;
    me.commandOutputQueue.pause();
    me.serial.drain(callback);
  });
};

GcodeSerial.prototype._handleSerialData = function(data) {
  this.currentResponse += data.toString();
  if (this.currentResponse.indexOf(READY_CUE) > -1) {
    this.currentResponse = this.currentResponse.split(READY_CUE)[0];
    if (this.lastCommand === "CONFIG") {
      this._loadConfig(this.currentResponse, function(err) {
        if (err) { console.log(err); }
        this.commandOutputQueue.resume();
      }.bind(this));
    } else {
      this.commandOutputQueue.resume();
    }
    this.currentResponse = "";
  }
};

GcodeSerial.prototype._loadConfig = function(configString, callback) {
  // TODO parse config string into machineConfig
  this.machineConfig = configString;
  this.emit("gotConfig", {
    machineWidth: 20,
    machineHeight: 30,
    drawingWidth: 40,
    drawingHeight: 999
  });
  callback(null);
};

module.exports = GcodeSerial;
