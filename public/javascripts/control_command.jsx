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
        <button onClick={this.handleClick} value="G01 Z90">Up</button>
        <button onClick={this.handleClick} value="G01 Z0">Down</button>
        <button onClick={this.handleClick} value="TELEPORT">This is Home</button>
        <button onClick={this.handleClick} value="G00 X0 Y0">Top Left</button>
        <button onClick={this.handleClick} value="G00 X200 Y0">Top Right</button>
      </div>
    );
  }
});

var controlCommand = React.renderComponent(<ControlCommand/>, document.getElementById('controlCommand'));
