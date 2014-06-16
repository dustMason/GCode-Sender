function GcodeViewer() {
  this.lines = [];
  this.lastPoint = { x:0, y:0, z:0, drawing:false };
  this.relative = false;
  this.drawingGroup = new paper.Group();
  this.unfinishedLineColor = new paper.Color(0.2);
  this.finishedLineColor = new paper.Color(1,0,0);
}

GcodeViewer.prototype.addSegment = function(fromPoint, toPoint, lineNumber, color) {
  // for now: only draw if toPoint.drawing === true
  if (toPoint.drawing) {
    var from = new paper.Point(fromPoint.x, fromPoint.y);
    var to = new paper.Point(toPoint.x, toPoint.y);
    var path = new paper.Path.Line(from, to);
    path.strokeColor = this.unfinishedLineColor;
    path.strokeWidth = 0.5;
    path.sendToBack();
    this.lines[lineNumber] = path;
    this.drawingGroup.addChild(path);
  } 
};

GcodeViewer.prototype.changeLineColor = function(index, color) {
  if (this.lines[index]) {
    this.lines[index].strokeColor = color;
    this.lines[index].bringToFront();
  }
};

GcodeViewer.prototype.renderPaper = function(width, height) {
  var paperRect = new paper.Path.Rectangle(0, 0, width, height);
  paperRect.position = paper.view.center;
  paperRect.style.fillColor = new paper.Color(1, 1, 1, 0.2);
  paper.view.draw();
};

GcodeViewer.prototype.renderDrawing = function(gcode, alreadyFinishedUpToLineNumber) {
  var me = this;

  var parser = new GCodeParser({
    G1: function(args, line) {
      // G1 means go in a straight line

      var newPoint = {
        x: args.x !== undefined ? me._absolute(me.lastPoint.x, args.x) : me.lastPoint.x,
        y: args.y !== undefined ? me._absolute(me.lastPoint.y, args.y) : me.lastPoint.y,
        z: args.z !== undefined ? me._absolute(me.lastPoint.z, args.z) : me.lastPoint.z
      };
      if (newPoint.z !== undefined && newPoint.z === 0) {
        newPoint.drawing = false;
      } else {
        newPoint.drawing = true;
      }

      var color = (line >= alreadyFinishedUpToLineNumber) ? me.unfinishedLineColor : me.finishedLineColor;
      me.addSegment(me.lastPoint, newPoint, line, color);
      me.lastPoint = newPoint;
    },

    G90: function(args) {
      me.relative = false;
    },

    G91: function(args) {
      me.relative = true;
    },

    'default': function(args, info) {
      console.error('Unknown command:', args.cmd, args, info);
    },
  });

  parser.parse(gcode);
  me.drawingGroup.position = paper.view.center;
  me.drawingGroup.bringToFront();
  paper.view.draw();

};

GcodeViewer.prototype._absolute = function(v1, v2) {
  return this.relative ? v1 + v2 : v2;
};
