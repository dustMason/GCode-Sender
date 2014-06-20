/** @jsx React.DOM */

var ControlCommand = React.createClass({
  getInitialState: function() {
    return { };
  },
  handleClick: function(e) {
    socket.emit("pushCommand", e.target.value);
  },
  handlePenUpClick: function() {
    socket.emit("pushCommand", "G01 Z" + this.state.penUpAngle);
  },
  handlePenDownClick: function() {
    socket.emit("pushCommand", "G01 Z" + this.state.penDownAngle);
  },
  handleTopLeftClick: function() {
    var left = (this.state.paperWidth / 2) * -1;
    var top = (this.state.paperHeight / 2) * -1;
    this._goToInCentimeters(left, top);
  },
  handleTopRightClick: function() {
    var left = (this.state.paperWidth / 2);
    var top = (this.state.paperHeight / 2) * -1;
    this._goToInCentimeters(left, top);
  },
  handleBottomRightClick: function() {
    var left = (this.state.paperWidth / 2);
    var top = (this.state.paperHeight / 2);
    this._goToInCentimeters(left, top);
  },
  handleBottomLeftClick: function() {
    var left = (this.state.paperWidth / 2) * -1;
    var top = (this.state.paperHeight / 2);
    this._goToInCentimeters(left, top);
  },
  handleConfig: function(config) {
    this.setState(config);
  },
  _goToInCentimeters: function(x, y) {
    socket.emit("pushCommand", "G01 X" + (x * 10) + " Y" + (y * 10));
  },
  render: function() {
    return (
      <div>
        <button onClick={this.handlePenUpClick}>Pen Up</button>
        <button onClick={this.handlePenDownClick}>Pen Down</button>
        <button onClick={this.handleClick} value="TELEPORT">This is Home</button>
        <button onClick={this.handleClick} value="G00 X0 Y0">Go Home</button>
        <button onClick={this.handleClick} value="G91;G01 X10 Y0;G90">Left</button>
        <button onClick={this.handleClick} value="G91;G01 X-10 Y0;G90">Right</button>
        <button onClick={this.handleClick} value="G91;G01 X0 Y-10;G90">Up</button>
        <button onClick={this.handleClick} value="G91;G01 X0 Y10;G90">Down</button>
        <button onClick={this.handleTopLeftClick}>Top Left</button>
        <button onClick={this.handleTopRightClick}>Top Right</button>
        <button onClick={this.handleBottomRightClick}>Bottom Right</button>
        <button onClick={this.handleBottomLeftClick}>Bottom Left</button>
      </div>
    );
  }
});

var controlCommand = React.renderComponent(<ControlCommand/>, document.getElementById('controlCommand'));
socket.on("gotConfig", controlCommand.handleConfig)
