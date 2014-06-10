/** @jsx React.DOM */

var ControlConfig = React.createClass({
getInitialState: function() {
  return {
    machineWidth: 0,
    machineHeight: 0,
    drawingWidth: 0,
    drawingHeight: 0
  }
},
loadConfig: function(machineConfig) {
  this.setState(machineConfig);
},
render: function() {
  return (
    <div>
      <label>Machine Width</label>
      <input type="text" value={this.state.machineWidth} />
      <label>Machine Height</label>
      <input type="text" value={this.state.machineHeight} />
      <label>Drawing Width</label>
      <input type="text" value={this.state.drawingWidth} />
      <label>Drawing Height</label>
      <input type="text" value={this.state.drawingHeight} />
      <button onClick={this.saveConfig}>Save</button>
    </div>
  );
}
});

var controlConfig = React.renderComponent(<ControlConfig/>, document.getElementById('controlConfig'));
socket.on("gotConfig", controlConfig.loadConfig);
