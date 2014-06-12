/** @jsx React.DOM */

var ControlConfig = React.createClass({
  getInitialState: function() {
    return {
      machineWidth: 0,
      machineHeight: 0,
      paperWidth: 0,
      paperHeight: 0,
      leftSpoolDiameter: 0,
      rightSpoolDiameter: 0
    };
  },
  loadConfig: function(machineConfig) {
    this.setState(machineConfig);
  },
  handleChange: function(e) {
    var stateChange = {};
    stateChange[e.target.name] = e.target.value;
    this.setState(stateChange);
  },
  saveConfig: function(e) {
    socket.emit("saveConfig", this.state);
  },
  render: function() {
    return (
      <div>
        <label>Machine Width</label>
        <input type="text" name="machineWidth" value={this.state.machineWidth} onChange={this.handleChange} />
        <label>Machine Height</label>
        <input type="text" name="machineHeight" value={this.state.machineHeight} onChange={this.handleChange} />
        <label>Paper Width</label>
        <input type="text" name="paperWidth" value={this.state.paperWidth} onChange={this.handleChange} />
        <label>Paper Height</label>
        <input type="text" name="paperHeight" value={this.state.paperHeight} onChange={this.handleChange} />
        <label>Left Spool Diameter</label>
        <input type="text" name="leftSpoolDiameter" value={this.state.leftSpoolDiameter} onChange={this.handleChange} />
        <label>Right Spool Diameter</label>
        <input type="text" name="rightSpoolDiameter" value={this.state.rightSpoolDiameter} onChange={this.handleChange} />
        <button onClick={this.saveConfig}>Save</button>
      </div>
    );
  }
});

var controlConfig = React.renderComponent(<ControlConfig/>, document.getElementById('controlConfig'));
socket.on("gotConfig", controlConfig.loadConfig);
