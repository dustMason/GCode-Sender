# The Hanging Hand

More information on this code is forthcoming. Quick intro:

- Arduino source for drawing machine firmware. Based on [Marginally Clever](https://www.marginallyclever.com)'s Makelangelo.
- Node.js app for controlling the machine, sending gcode files and viewing status.

After building my own Makelangelo style machine and using the provided control software (written in java) I decided to create my own to address a few things I wanted to do. This design allows the control app to run on a small device (such as a Raspberry Pi in my case) connected to the Arduino. Any device with a web browser can then interface with and monitor the machine.

The node app depends on `node-serialport` for serial communication. With node.js installed, simply run `npm install` and then `node app.js` to fire it up. You'll need to load up the included drawing machine firmware to use it, of course!

Currently pre-alpha status, but it works!

