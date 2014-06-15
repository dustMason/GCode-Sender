/** @jsx React.DOM */

var ControlCommand = React.createClass({
  getInitialState: function() {
    return { };
  },
  handleClick: function(e) {
    socket.emit("pushCommand", e.target.value);
  },
  render: function() {
    return (
      <div>
        <button onClick={this.handleClick} value="G01 Z90">Pen Up</button>
        <button onClick={this.handleClick} value="G01 Z0">Pen Down</button>
        <button onClick={this.handleClick} value="TELEPORT">This is Home</button>
        <button onClick={this.handleClick} value="G00 X0 Y0">Go Home</button>
        <button onClick={this.handleClick} value="G91;G00 X10 Y0;G90">Left</button>
        <button onClick={this.handleClick} value="G91;G00 X-10 Y0;G90">Right</button>
        <button onClick={this.handleClick} value="G91;G00 X0 Y-10;G90">Up</button>
        <button onClick={this.handleClick} value="G91;G00 X0 Y10;G90">Down</button>
      </div>
    );
  }
});

var controlCommand = React.renderComponent(<ControlCommand/>, document.getElementById('controlCommand'));
