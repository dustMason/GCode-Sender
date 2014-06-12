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

io.on('connection', function(socket) {
  console.log('a user connected');

  var serial = new GcodeSerial();
  socket.on("listPorts", function() {
    serial.listPorts();
  });
  serial.on("listedPorts", function(ports) {
    io.emit("listedPorts", ports);
  });

  socket.on("connectToMachine", function(portName) {
    serial.connect(portName);
  });
  serial.on("connected", function() {
    io.emit("connected");
  });

  socket.on("pushCommand", function(command) {
    serial.pushCommand(command);
  });

  socket.on("saveConfig", function(machineConfig) {
    serial.saveConfig(machineConfig);
  });
  serial.on("gotConfig", function(machineConfig) {
    io.emit("gotConfig", machineConfig);
  });

  // fs.createReadStream(__dirname + '/../public/shaded_sphere.ngc').pipe(serial);

  socket.on('disconnect', function(){
    console.log('user disconnected');
    serial.disconnect();
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
