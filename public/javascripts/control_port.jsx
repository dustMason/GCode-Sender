/** @jsx React.DOM */

var ControlPort = React.createClass({
  getInitialState: function() {
    return {
      portListOptions: '',
      currentPortName: '',
      connected: false
    };
  },
  componentDidMount: function() {
    socket.emit("listPorts");
  },
  handleConnectButtonClick: function() {
    socket.emit("connectToMachine", this.state.currentPortName);
  },
  handlePortSelectChange: function(event) {
    this.setState({currentPortName: event.target.value});
  },
  setPortList: function(ports) {
    this.setState({
      portListOptions: ports.map(function(portName){
        return <option value={portName}>{portName}</option>;
      }),
      currentPortName: ports[0]
    });
  },
  handleConnected: function() {
    this.setState({connected: true});
  },
  render: function() {
    return (
      <div className="controlPort controlBlock">
        <label>Port</label>
        <select onChange={this.handlePortSelectChange} value={this.state.currentPortName}>{this.state.portListOptions}</select>
        <button onClick={this.handleConnectButtonClick}>Connect</button>
      </div>
    );
  }
});

var controlPort = React.renderComponent(<ControlPort/>, document.getElementById('controlPort'));
socket.on("listedPorts", controlPort.setPortList);
socket.on("connected", controlPort.handleConnected);
