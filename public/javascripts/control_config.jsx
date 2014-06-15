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
      <div className="controlConfig controlBlock cf">
        <div className="machineBox">
          <div className="machine-width">
            <label className="tab">W</label>
            <input type="text" name="machineWidth" value={this.state.machineWidth} onChange={this.handleChange} />
          </div>
          <div className="machine-height">
            <label className="tab">H</label>
            <input type="text" name="machineHeight" value={this.state.machineHeight} onChange={this.handleChange} />
          </div>
          <div className="paperBox">
            <div className="paper-width">
              <label className="tab">W</label>
              <input type="text" name="paperWidth" value={this.state.paperWidth} onChange={this.handleChange} />
            </div>
            <div className="paper-height">
              <label className="tab">H</label>
              <input type="text" name="paperHeight" value={this.state.paperHeight} onChange={this.handleChange} />
            </div>
          </div>
        </div>


        <div class="diameterBox">
          <p>Spool Diameters</p>
          <div>
            <label className="tab">L</label>
            <input type="text" name="leftSpoolDiameter" value={this.state.leftSpoolDiameter} onChange={this.handleChange} />
          </div>
          <div>
            <label className="tab">R</label>
            <input type="text" name="rightSpoolDiameter" value={this.state.rightSpoolDiameter} onChange={this.handleChange} />
          </div>
        </div>

        <button onClick={this.saveConfig}>Save</button>
      </div>
    );
  }
});

var controlConfig = React.renderComponent(<ControlConfig/>, document.getElementById('controlConfig'));
socket.on("gotConfig", controlConfig.loadConfig);
