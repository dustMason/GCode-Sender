/** @jsx React.DOM */

var CommandLog = React.createClass({
  componentDidUpdate: function() {
    var node = this.getDOMNode();
    $(node).scrollTop(node.scrollHeight);
  },
  render: function() {
    var logItems = this.props.data.map(function(item) {
      return <li>{item}</li>;
    });
    return <div className="log"><ul>{logItems}</ul></div>;
  }
});

var ControlFeed = React.createClass({
  getInitialState: function() {
    return {logItems:[]};
  },
  handleSentCommand: function(commandObject) {
    var command = commandObject.line + ". " + commandObject.command;
    var newItems = this.state.logItems.concat([command]);
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
  handleGoClick: function(e) {
    socket.emit("resumeQueue");
  },
  handlePauseClick: function(e) {
    socket.emit("pauseQueue");
  },
  render: function() {
    return (
      <div>
        <button value="" onClick={this.handleGoClick}>Go</button>
        <button value="" onClick={this.handlePauseClick}>P</button>
        <button value="">Skip To</button>
        <input type="text" name="skipToLineNumber" />
        <input type="file" name="gcodeFile" onChange={this.handleGcodeFile} />
        <CommandLog data={this.state.logItems} />
      </div>
    );
  }
});

var controlFeed = React.renderComponent(<ControlFeed/>, document.getElementById('controlFeed'));
socket.on("sentCommand", controlFeed.handleSentCommand);
