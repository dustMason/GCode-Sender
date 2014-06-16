var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var DrawingMachine = require("./drawing-machine.js");

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

var machine = new DrawingMachine();

io.on('connection', function(socket) {
  console.log('User connected', socket.id);

  if (machine.machineIsConnected) {
    // we're late to the party - machine is already connected
    socket.emit("gotConfig", machine.machineConfig);
    socket.emit("loadedGcodeFile", machine.currentGcodeFile, machine.currentLineNumber);
  }

  var _events = {};

  socket.on("listPorts", machine.listPorts.bind(machine));
  _events.listedPorts = function(ports) {
    socket.emit("listedPorts", ports);
  };
  machine.on("listedPorts", _events.listedPorts);

  socket.on("connectToMachine", machine.connect.bind(machine));
  _events.connected = function() {
    socket.emit("connected");
  };
  machine.on("connected", _events.connected);

  socket.on("pushCommand", machine.pushCommand.bind(machine));

  socket.on("saveConfig", machine.saveConfig.bind(machine));
  _events.gotConfig = function(machineConfig) {
    socket.emit("gotConfig", machineConfig);
  };
  machine.on("gotConfig", _events.gotConfig);

  _events.sentCommand = function(command) {
    socket.emit("sentCommand", command);
  };
  machine.on("sentCommand", _events.sentCommand);

  socket.on("loadGcodeFile", machine.loadGcodeFile.bind(machine));
  _events.loadedGcodeFile = function(fileContents) {
    socket.emit("loadedGcodeFile", fileContents);
  };
  machine.on("loadedGcodeFile", _events.loadedGcodeFile);

  socket.on("pauseQueue", machine.pauseQueue.bind(machine));
  socket.on("resumeQueue", machine.resumeQueue.bind(machine));

  socket.on('disconnect', function() {
    for (var eventName in _events) {
      machine.removeListener(eventName, _events[eventName]);
      delete _events[eventName];
    }
    console.log('User disconnected', socket.id);
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
