/** @jsx React.DOM */

var CommandLog = React.createClass({
  componentDidUpdate: function() {
    var node = this.getDOMNode();
    $(node).scrollTop(node.scrollHeight);
  },
  render: function() {
    var logItems = this.props.data.map(function(item) {
      var itemContents = "";
      if (item.line) { itemContents += item.line + ". " }
      if (item.command) { itemContents += item.command }
      return <li>{itemContents}</li>;
    });
    return <div className="log"><ul>{logItems}</ul></div>;
  }
});

var ControlFeed = React.createClass({
  getInitialState: function() {
    return {
      logItems:[],
      drawing: false
    };
  },
  handleSentCommand: function(commandObject) {
    var newItems = this.state.logItems.concat([commandObject]);
    this.setState({logItems: newItems});
  },
  handleGcodeFile: function(event) {
    var files = event.nativeEvent.target.files;
    var file = files[0];
    var reader = new FileReader();
    reader.onload = (function(theFile) {
      return function(e) {
        socket.emit("loadGcodeFile", e.target.result);
      };
    })(file);
    reader.readAsText(file);
  },
  handleStartedDrawing: function() {
    this.setState({drawing: true});
  },
  handlePausedDrawing: function() {
    this.setState({drawing: false});
  },
  handleStartClick: function(e) {
    socket.emit("startDrawing");
  },
  handlePauseClick: function(e) {
    socket.emit("pauseDrawing");
  },
  render: function() {
    var initControls = <div>
      <button value="" onClick={this.handleStartClick}>Start</button>
      <input type="text" name="skipToLineNumber" />
      <button value="">Skip To</button>
      <input type="file" name="gcodeFile" onChange={this.handleGcodeFile} />
    </div>
    var inProgressControls = <div>
      <button value="" onClick={this.handlePauseClick}>Pause</button>
    </div>
    return (
      <div>
        {this.state.drawing ? inProgressControls : initControls}
        <CommandLog data={this.state.logItems} />
      </div>
    );
  }
});

var controlFeed = React.renderComponent(<ControlFeed/>, document.getElementById('controlFeed'));
socket.on("sentCommand", controlFeed.handleSentCommand);
socket.on("startedDrawing", controlFeed.handleStartedDrawing);
socket.on("pausedDrawing", controlFeed.handlePausedDrawing);
