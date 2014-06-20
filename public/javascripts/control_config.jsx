/** @jsx React.DOM */

var ControlConfig = React.createClass({
  getInitialState: function() {
    return {
      machineWidth: 0,
      machineHeight: 0,
      paperWidth: 0,
      paperHeight: 0,
      leftSpoolDiameter: 0,
      rightSpoolDiameter: 0,
      penUpAngle: 0,
      penDownAngle: 0,
      penDelay: 0,
      stepStyle: 0
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

        <div className="diameterBox">
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

        <div className="penAngleBox">
          <p>Pen Angle</p>
          <div>
            <label className="tab">U</label>
            <input type="text" name="penUpAngle" value={this.state.penUpAngle} onChange={this.handleChange} />
          </div>
          <div>
            <label className="tab">D</label>
            <input type="text" name="penDownAngle" value={this.state.penDownAngle} onChange={this.handleChange} />
          </div>
          <div>
            <label className="tab">Delay</label>
            <input type="text" name="penDelay" value={this.state.penDelay} onChange={this.handleChange} />
          </div>
        </div>

        <div className="stepStyleBox">
          <p>Step Style</p>
          <div>
            <select id="stepStyle" name="stepStyle" value={this.state.stepStyle} onChange={this.handleChange}>
              <option value="1">Single</option>
              <option value="2">Double</option>
              <option value="3">Interleave</option>
              <option value="4">Microstep</option>
            </select>
          </div>
        </div>

        <button onClick={this.saveConfig}>Save</button>
      </div>
    );
  }
});

var controlConfig = React.renderComponent(<ControlConfig/>, document.getElementById('controlConfig'));
socket.on("gotConfig", controlConfig.loadConfig);
