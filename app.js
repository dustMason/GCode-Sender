var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var GcodeSerial = require("./gcode_serial.js");

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  res.render('index');
});

var serial = new GcodeSerial();

io.on('connection', function(socket) {
  console.log('a user connected', socket.id);
  
  if (serial.machineIsConnected) {
    // we're late to the party - machine is already connected
    socket.emit("gotConfig", serial.machineConfig);
    socket.emit("loadedGcodeFile", serial.currentGcodeFile);
  }

  var _events = {};

  socket.on("listPorts", serial.listPorts);
  _events.listedPorts = function(ports) {
    socket.emit("listedPorts", ports);
  };
  serial.on("listedPorts", _events.listedPorts);

  socket.on("connectToMachine", serial.connect);
  _events.connected = function() {
    socket.emit("connected");
  };
  serial.on("connected", _events.connected);

  socket.on("pushCommand", serial.pushCommand);

  socket.on("saveConfig", serial.saveConfig);
  _events.gotConfig = function(machineConfig) {
    socket.emit("gotConfig", machineConfig);
  };
  serial.on("gotConfig", _events.gotConfig);

  _events.sentCommand = function(command) {
    socket.emit("sentCommand", command);
  };
  serial.on("sentCommand", _events.sentCommand);

  socket.on("loadGcodeFile", serial.loadGcodeFile);
  _events.loadedGcodeFile = function(fileContents) {
    socket.emit("loadedGcodeFile", fileContents);
  };
  serial.on("loadedGcodeFile", _events.loadedGcodeFile);

  socket.on('disconnect', function() {
    for (var eventName in _events) {
      serial.removeListener(eventName, _events[eventName]);
      delete _events[eventName];
    }
    console.log('user disconnected', socket.id);
  });
});

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
