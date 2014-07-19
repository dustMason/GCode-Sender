//------------------------------------------------------------------------------
// Draw robot - Supports Adafruit motor shield v2
// Originally written by dan@marginallycelver.com 2013 OCT 08
// Forked by dustMason (http://github.com/dustMason) 2014 MAY
//------------------------------------------------------------------------------
// Copyright at end of file.  Please see
// https://github.com/dustMason/GCode-Sender and
// http://www.github.com/MarginallyClever/Makelangelo for more information.

// plan for inkshield integration:
// accept new C param on G00 and G01 commands to signify rotation around
// the Z axis. Z axis is ignored with inkshield (although possibly implemented
// later somehow). when C param is parsed, interpret at same step that Z is
// currently handled. calculate time needed for movement and use that to inform
// pause time?

// use M command range to turn on and off ink spraying functions of cart?
// maybe better to use another command suffix to allow each coordinate its own
// spray rate.

//------------------------------------------------------------------------------
// CONSTANTS
//------------------------------------------------------------------------------

// which motor is on which pin?
#define M1_PIN          (2)
#define M2_PIN          (1)

// which limit switch is on which pin?
#define L_PIN          (A3)
#define R_PIN          (A5)

#define MAX_RPM         (3000.0)
#define MIN_VEL         (0.001) // cm/s

// for arc directions
#define ARC_CW          (1)
#define ARC_CCW         (-1)
// Arcs are split into many line segments.  How long are the segments?
#define CM_PER_SEGMENT   (0.2)

// Serial communication bitrate
#define BAUD            (57600)
// Maximum length of serial input message.
#define MAX_BUF         (64)

// stacked motor shields have different addresses.  The default is 0x60
#define SHIELD_ADDRESS  (0x60)

// servo pin differs based on device
#define SERVO_PIN       (10)

//------------------------------------------------------------------------------
// EEPROM MEMORY MAP
//------------------------------------------------------------------------------
#define EEPROM_VERSION        6             // Increment EEPROM_VERSION when adding new variables
#define ADDR_VERSION          0             // address of the version number (one byte)
#define ADDR_SPOOL_DIA1       4             // address of the spool diameter (float - 4 bytes)
#define ADDR_SPOOL_DIA2       8             // address of the spool diameter (float - 4 bytes)
#define ADDR_MACHINE_WIDTH    12            // (float - 4 bytes)
#define ADDR_MACHINE_HEIGHT   16            // (float - 4 bytes)
#define ADDR_PAPER_WIDTH      20            // (float - 4 bytes)
#define ADDR_PAPER_HEIGHT     24            // (float - 4 bytes)
#define ADDR_PEN_UP_ANGLE     28            // (int - 2 bytes)
#define ADDR_PEN_DOWN_ANGLE   30            // (int - 2 bytes)
#define ADDR_PEN_DELAY        32            // (int - 2 bytes)
#define ADDR_STEP_STYLE       34            // (int - 2 bytes)

//------------------------------------------------------------------------------
// INCLUDES
//------------------------------------------------------------------------------
#include <Wire.h>
#include <Adafruit_MotorShield.h>

// Default servo library
#include <Servo.h>

// Saving config
#include <EEPROM.h>
#include <Arduino.h>
#include "EEPROMAnything.h"

// Robert Penner's easing algos via http://portfolio.tobiastoft.dk/Easing-library-for-Arduino
#include <Easing.h>

//------------------------------------------------------------------------------
// VARIABLES
//------------------------------------------------------------------------------
// Initialize Adafruit stepper controller
Adafruit_MotorShield AFMS0 = Adafruit_MotorShield(SHIELD_ADDRESS);
Adafruit_StepperMotor *m1;
Adafruit_StepperMotor *m2;

static Servo s1;

static int STEP_STYLE;
// attention: these get set by adjustStepStyle below
static int MAX_STEPS_S;
static float MAX_VEL; // cm/s
static int STEPS_PER_TURN;

// config values. used to calculate limits below
static float MACHINE_WIDTH;
static float MACHINE_HEIGHT;
static float PAPER_WIDTH;
static float PAPER_HEIGHT;

// servo angles for pen control
// attention: these are set by EEPROM config
static int PEN_UP_ANGLE;
static int PEN_DOWN_ANGLE; // Some steppers don't like 0 degrees
static int PEN_DELAY; // in ms (250 is good)

// plotter limits
// all distances are relative to the calibration point of the plotter.
// (normally this is the center of the drawing area)
static float limit_top;  // distance to top of drawing area.
static float limit_bottom;  // Distance to bottom of drawing area.
static float limit_right;  // Distance to right of drawing area.
static float limit_left;  // Distance to left of drawing area.

// what are the motors called?
char m1d = 'L';
char m2d = 'R';

// which way are the spools wound, relative to motor movement?
int M1_REEL_IN  = FORWARD;
int M1_REEL_OUT = BACKWARD;
int M2_REEL_IN  = BACKWARD;
int M2_REEL_OUT = FORWARD;

// calculate some numbers to help us find feed_rate
// attention: these are set by adjustSpoolDiameter below
float SPOOL_DIAMETER1;
float SPOOL_DIAMETER2;

float THREADPERSTEP1; // thread per step
float THREADPERSTEP2; // thread per step

// plotter position.
static float posx, velx;
static float posy, vely;
static float posz; // pen state
static float feed_rate=0;
static long step_delay;

// motor position
static long laststep1, laststep2;

static char absolute_mode=1; // absolute or incremental programming mode?
static float mode_scale; // mm or inches?
static char mode_name[3];

// time values
static long  t_millis;
static float t; // since board power on
static float dt; // since last tick

// Serial comm reception
static char buffer[MAX_BUF]; // Serial buffer
static int sofar; // Serial buffer progress

static void adjustSpoolDiameter(float diameter1, float diameter2) {
  SPOOL_DIAMETER1 = diameter1;
  float SPOOL_CIRC = SPOOL_DIAMETER1 * PI;
  THREADPERSTEP1 = SPOOL_CIRC / STEPS_PER_TURN;

  SPOOL_DIAMETER2 = diameter2;
  SPOOL_CIRC = SPOOL_DIAMETER2 * PI;
  THREADPERSTEP2 = SPOOL_CIRC / STEPS_PER_TURN;

  float MAX_VEL1 = MAX_STEPS_S * THREADPERSTEP1; // cm/s
  float MAX_VEL2 = MAX_STEPS_S * THREADPERSTEP2; // cm/s
  MAX_VEL = MAX_VEL1 > MAX_VEL2 ? MAX_VEL1 : MAX_VEL2;
  setFeedRate(MAX_VEL * 30 / mode_scale); // *30 because i also /2
}

static void adjustMachineLimits(float machineWidth, float machineHeight) {
  MACHINE_HEIGHT = machineHeight;
  MACHINE_WIDTH = machineWidth;
  limit_top = (machineHeight / 2.0) * -1;
  limit_bottom = machineHeight / 2.0;
  limit_left = (machineWidth / 2.0) * -1;
  limit_right = machineWidth / 2.0;
}

static void adjustStepStyle(int style) {
  STEP_STYLE = style;
  // NEMA17 are 200 steps (1.8 degrees) per turn.  If a spool is 0.8 diameter
  // then it is 2.5132741228718345 circumference, and
  // 2.5132741228718345 / 200 = 0.0125663706 thread moved each step.
  // NEMA17 are rated up to 3000RPM.  Adafruit can handle >1000RPM.
  // These numbers directly affect the maximum velocity.
  if (style == MICROSTEP) {
    STEPS_PER_TURN = 3200;
  } else if (style == INTERLEAVE) {
    STEPS_PER_TURN = 400;
  } else {
    STEPS_PER_TURN = 200;
  }
  MAX_STEPS_S = STEPS_PER_TURN * MAX_RPM / 60.0; // steps/s
  // MAX_VEL = MAX_STEPS_S * THREADPERSTEP1; // cm/s // gets set again by adjustSpoolDiameter anyway...
}

// increment internal clock
static void tick() {
  long nt_millis = millis();
  long dt_millis = nt_millis - t_millis;

  t_millis = nt_millis;

  dt = (float)dt_millis * 0.001; // time since last tick, in seconds
  t = (float)nt_millis * 0.001;
}

// returns angle of dy/dx as a value from 0...2PI
static float atan3(float dy, float dx) {
  float a = atan2(dy, dx);
  if (a < 0) {
    a = (PI * 2.0) + a;
  }
  return a;
}

// feed rate is given in units/min and converted to cm/s
static void setFeedRate(float v) {
  float v1 = v * mode_scale/60.0;
  if( feed_rate != v1 ) {
    feed_rate = v1;
    if(feed_rate > MAX_VEL) feed_rate=MAX_VEL;
    if(feed_rate < MIN_VEL) feed_rate=MIN_VEL;
  }

  long step_delay1 = 1000000.0 / (feed_rate/THREADPERSTEP1);
  long step_delay2 = 1000000.0 / (feed_rate/THREADPERSTEP2);
  step_delay = step_delay1 > step_delay2 ? step_delay1 : step_delay2;
}

static void printFeedRate() {
  Serial.print(F("RATE:"));
  Serial.print(F("f1="));
  Serial.print(feed_rate * 60.0 / mode_scale);
  Serial.print(mode_name);
  Serial.print(F("/min"));
}

// Change pen state.
static void setPenAngle(int pen_angle) {
  if(posz!=pen_angle) {
    posz=pen_angle;

    if(posz<PEN_DOWN_ANGLE) posz=PEN_DOWN_ANGLE;
    if(posz>PEN_UP_ANGLE  ) posz=PEN_UP_ANGLE;

    s1.write( (int)posz );
    delay(PEN_DELAY);
  }
}

// Inverse Kinematics - turns XY coordinates into lengths L1,L2
static void IK(float x, float y, long &l1, long &l2) {
  // find length to M1
  float dy = y - limit_top;
  float dx = x - limit_left;
  l1 = floor( sqrt(dx*dx+dy*dy) / THREADPERSTEP1 );
  // find length to M2
  dx = limit_right - x;
  l2 = floor( sqrt(dx*dx+dy*dy) / THREADPERSTEP2 );
}

// Forward Kinematics - turns L1,L2 lengths into XY coordinates
// use law of cosines: theta = acos((a*a+b*b-c*c)/(2*a*b));
// to find angle between M1M2 and M1P where P is the plotter position.
static void FK(float l1, float l2,float &x,float &y) {
  float a = l1 * THREADPERSTEP1;
  float b = (limit_right-limit_left);
  float c = l2 * THREADPERSTEP2;
  float i=(a*a+b*b-c*c)/(2.0*a*b);
  x = i * l1 + limit_left;
  y = sqrt(1.0 - i*i)*l1 + limit_top;
}

static void line_safe(float x,float y,float z) {
  // split up long lines to make them straighter?
  float dx=x-posx;
  float dy=y-posy;

  float len=sqrt(dx*dx+dy*dy);

  if(len<=CM_PER_SEGMENT) {
    line(x,y,z,step_delay);
    return;
  }

  // too long!
  long pieces=floor(len/CM_PER_SEGMENT);
  float x0=posx;
  float y0=posy;
  float z0=posz;
  float a;

  long current_step_delay;

  for(long j=0;j<=pieces;++j) {
    a=(float)j/(float)pieces;

    if (j < pieces/2) {
      current_step_delay = step_delay - Easing::easeOutExpo(j, 0, step_delay, pieces/2);
    } else {
      current_step_delay = Easing::easeInExpo(j, 0, step_delay, pieces);
    }

    line((x-x0)*a+x0,
         (y-y0)*a+y0,
         (z-z0)*a+z0,
         current_step_delay);
  }
  line(x,y,z,current_step_delay);
}

void pause(long ms) {
  delay(ms/1000);
  delayMicroseconds(ms%1000);
}

static void line(float x,float y,float z,long delay_ms) {
  long l1,l2;
  IK(x,y,l1,l2);
  long d1 = l1 - laststep1;
  long d2 = l2 - laststep2;

  long ad1=abs(d1);
  long ad2=abs(d2);
  int dir1=d1<0?M1_REEL_IN:M1_REEL_OUT;
  int dir2=d2<0?M2_REEL_IN:M2_REEL_OUT;
  long over=0;
  long i;

  setPenAngle((int)z);

  // bresenham's line algorithm.
  if(ad1>ad2) {
    for(i=0;i<ad1;++i) {
      m1->onestep(dir1,STEP_STYLE);
      over+=ad2;
      if(over>=ad1) {
        over-=ad1;
        m2->onestep(dir2,STEP_STYLE);
      }
      pause(delay_ms);
    }
  } else {
    for(i=0;i<ad2;++i) {
      m2->onestep(dir2,STEP_STYLE);
      over+=ad1;
      if(over>=ad2) {
        over-=ad2;
        m1->onestep(dir1,STEP_STYLE);
      }
      pause(delay_ms);
    }
  }

  laststep1=l1;
  laststep2=l2;
  posx=x;
  posy=y;
}


// This method assumes the limits have already been checked.
// This method assumes the start and end radius match.
// This method assumes arcs are not >180 degrees (PI radians)
// cx/cy - center of circle
// x/y - end position
// dir - ARC_CW or ARC_CCW to control direction of arc
static void arc(float cx,float cy,float x,float y,float z,float dir) {
  // get radius
  float dx = posx - cx;
  float dy = posy - cy;
  float radius=sqrt(dx*dx+dy*dy);

  // find angle of arc (sweep)
  float angle1=atan3(dy,dx);
  float angle2=atan3(y-cy,x-cx);
  float theta=angle2-angle1;

  if(dir>0 && theta<0) angle2+=2*PI;
  else if(dir<0 && theta>0) angle1+=2*PI;

  theta=angle2-angle1;

  // get length of arc
  // float circ=PI*2.0*radius;
  // float len=theta*circ/(PI*2.0);
  // simplifies to
  float len = abs(theta) * radius;

  int i, segments = floor( len / CM_PER_SEGMENT );

  float nx, ny, nz, angle3, scale;

  for(i=0;i<segments;++i) {
    // interpolate around the arc
    scale = ((float)i)/((float)segments);

    angle3 = ( theta * scale ) + angle1;
    nx = cx + cos(angle3) * radius;
    ny = cy + sin(angle3) * radius;
    nz = ( z - posz ) * scale + posz;
    // send it to the planner
    line(nx,ny,nz,step_delay);
  }

  line(x,y,z,step_delay);
}

// instantly move the virtual plotter position
// does not validate if the move is valid
static void teleport(float x,float y) {
  posx=x;
  posy=y;

  // @TODO: posz?
  long L1,L2;
  IK(posx,posy,L1,L2);
  laststep1=L1;
  laststep2=L2;
}

static void help() {
  Serial.println(F("See github.com/dustMason/GCode-Sender"));
}

static void where() {
  Serial.print(F("WHERE:"));
  Serial.print(F("X"));
  Serial.print(posx);
  Serial.print(F(" Y"));
  Serial.print(posy);
  Serial.print(F(" Z"));
  Serial.print(posz);
  Serial.print(F("\n"));
}

static void printConfig() {
  Serial.print(F("CONFIG:"));
  Serial.print(F("W="));
  Serial.println(MACHINE_WIDTH);
  Serial.print(F("H="));
  Serial.println(MACHINE_HEIGHT);
  Serial.print(F("M="));
  Serial.println(m1d);
  Serial.print(F("N="));
  Serial.println(m2d);
  Serial.print(F("O="));
  Serial.println(PAPER_WIDTH);
  Serial.print(F("P="));
  Serial.println(PAPER_HEIGHT);
  Serial.print(F("Q="));
  Serial.println(SPOOL_DIAMETER1);
  Serial.print(F("R="));
  Serial.println(SPOOL_DIAMETER2);
  Serial.print(F("S="));
  Serial.println(STEP_STYLE);
  Serial.print(F("T="));
  Serial.println(PEN_UP_ANGLE);
  Serial.print(F("U="));
  Serial.println(PEN_DOWN_ANGLE);
  Serial.print(F("V="));
  Serial.println(PEN_DELAY);
}

static void applyMachineConfig(int step_style, float diameter1, float diameter2, float machine_width, float machine_height) {
  adjustStepStyle(step_style); // this must be called BEFORE adjustSpoolDiameter
  adjustSpoolDiameter(diameter1, diameter2);
  adjustMachineLimits(machine_width, machine_height);
  m1 = AFMS0.getStepper(STEPS_PER_TURN, M2_PIN);
  m2 = AFMS0.getStepper(STEPS_PER_TURN, M1_PIN);
}

static void LoadConfigFromEEPROM() {
  char version_number = EEPROM.read(ADDR_VERSION);
  if (version_number != EEPROM_VERSION) {
    EEPROM.write(ADDR_VERSION, EEPROM_VERSION);
    saveConfigToEEPROM();
  } else {
    unsigned int n = 0;
    float _diameter1;
    float _diameter2;
    float _machinewidth;
    float _machineheight;
    int _step_style;
    n = EEPROM_readAnything(ADDR_SPOOL_DIA1, _diameter1);
    n = EEPROM_readAnything(ADDR_SPOOL_DIA2, _diameter2);
    n = EEPROM_readAnything(ADDR_MACHINE_WIDTH, _machinewidth);
    n = EEPROM_readAnything(ADDR_MACHINE_HEIGHT, _machineheight);
    n = EEPROM_readAnything(ADDR_STEP_STYLE, _step_style);
    n = EEPROM_readAnything(ADDR_PAPER_WIDTH, PAPER_WIDTH);
    n = EEPROM_readAnything(ADDR_PAPER_HEIGHT, PAPER_HEIGHT);
    n = EEPROM_readAnything(ADDR_PEN_UP_ANGLE, PEN_UP_ANGLE);
    n = EEPROM_readAnything(ADDR_PEN_DOWN_ANGLE, PEN_DOWN_ANGLE);
    n = EEPROM_readAnything(ADDR_PEN_DELAY, PEN_DELAY);
    applyMachineConfig(_step_style, _diameter1, _diameter2, _machinewidth, _machineheight);
  }
}


static void saveConfigToEEPROM() {
  unsigned int n = 0;
  n = EEPROM_writeAnything(ADDR_SPOOL_DIA1, SPOOL_DIAMETER1);
  n = EEPROM_writeAnything(ADDR_SPOOL_DIA2, SPOOL_DIAMETER2);
  n = EEPROM_writeAnything(ADDR_MACHINE_WIDTH, MACHINE_WIDTH);
  n = EEPROM_writeAnything(ADDR_MACHINE_HEIGHT, MACHINE_HEIGHT);
  n = EEPROM_writeAnything(ADDR_PAPER_WIDTH, PAPER_WIDTH);
  n = EEPROM_writeAnything(ADDR_PAPER_HEIGHT, PAPER_HEIGHT);
  n = EEPROM_writeAnything(ADDR_PEN_UP_ANGLE, PEN_UP_ANGLE);
  n = EEPROM_writeAnything(ADDR_PEN_DOWN_ANGLE, PEN_DOWN_ANGLE);
  n = EEPROM_writeAnything(ADDR_PEN_DELAY, PEN_DELAY);
  n = EEPROM_writeAnything(ADDR_STEP_STYLE, STEP_STYLE);
}


//------------------------------------------------------------------------------
static int processSubcommand() {
  int found = 0;
  char *ptr = buffer;
  while (ptr && ptr < buffer + sofar && strlen(ptr)) {
    if (!strncmp(ptr, "G20", 3)) {
      mode_scale = 2.54f;  // inches -> cm
      strcpy(mode_name, "in");
      found = 1;
    } else if (!strncmp(ptr, "G21", 3)) {
      mode_scale = 0.1;  // mm -> cm
      strcpy(mode_name, "mm");
      found = 1;
    } else if (!strncmp(ptr, "G90", 3)) {
      // absolute mode
      absolute_mode = 1;
      found = 1;
    } else if (!strncmp(ptr, "G91", 3)) {
      // relative mode
      absolute_mode = 0;
      found = 1;
    }
    ptr = strchr(ptr, ' ') + 1;
  }
  return found;
}


//------------------------------------------------------------------------------
static void processCommand() {
  // blank lines
  if(buffer[0]==';') return;

  if(!strncmp(buffer,"HELP",4)) {
    help();
  } else if(!strncmp(buffer,"TELEPORT",8)) {
    float xx=posx;
    float yy=posy;

    char *ptr=buffer;
    while(ptr && ptr<buffer+sofar) {
      ptr=strchr(ptr,' ')+1;
      switch(*ptr) {
      case 'X': xx=atof(ptr+1)*mode_scale;  break;
      case 'Y': yy=atof(ptr+1)*mode_scale;  break;
      default: ptr=0; break;
      }
    }

    teleport(xx,yy);
  } else if(!strncmp(buffer,"M114",4)) {
    where();
  } else if(!strncmp(buffer,"M18",3)) {
    // disable motors
    m1->release();
    m2->release();
  } else if(!strncmp(buffer,"CONFIG",6)) {
    float _machine_width = MACHINE_WIDTH;
    float _machine_height = MACHINE_HEIGHT;
    float _paper_width = PAPER_WIDTH;
    float _paper_height = PAPER_HEIGHT;
    char _m1d = m1d;
    char _m2d = m2d;
    float amountL = SPOOL_DIAMETER1;
    float amountR = SPOOL_DIAMETER2;
    int _step_style = STEP_STYLE;
    int _pen_up_angle = PEN_UP_ANGLE;
    int _pen_down_angle = PEN_DOWN_ANGLE;
    int _pen_delay = PEN_DELAY;

    char *ptr=buffer;
    while(ptr && ptr < buffer + sofar && strlen(ptr)) {
      ptr = strchr(ptr, ' ') + 1;
      switch (*ptr) {
        case 'W': _machine_width = atof(ptr + 1); break;
        case 'H': _machine_height = atof(ptr + 1); break;
        case 'M': _m1d = *(ptr + 1); break;
        case 'N': _m2d = *(ptr + 1); break;
        case 'O': _paper_width = atof(ptr + 1); break;
        case 'P': _paper_height = atof(ptr + 1); break;
        case 'Q': amountL = atof(ptr + 1); break;
        case 'R': amountR = atof(ptr + 1); break;
        case 'S': _step_style = atoi(ptr + 1); break;
        case 'T': _pen_up_angle = atoi(ptr + 1); break;
        case 'U': _pen_down_angle = atoi(ptr + 1); break;
        case 'V': _pen_delay = atoi(ptr + 1); break;
        case 'I':
          if (atoi(ptr + 1) > 0) {
            M1_REEL_IN = FORWARD;
            M1_REEL_OUT = BACKWARD;
          } else {
            M1_REEL_IN = BACKWARD;
            M1_REEL_OUT = FORWARD;
          }
          break;
        case 'J':
          if (atoi(ptr + 1) > 0) {
            M2_REEL_IN = FORWARD;
            M2_REEL_OUT = BACKWARD;
          } else {
            M2_REEL_IN = BACKWARD;
            M2_REEL_OUT = FORWARD;
          }
          break;
        }
      }

    m1d=_m1d;
    m2d=_m2d;

    PAPER_WIDTH = _paper_width;
    PAPER_HEIGHT = _paper_height;
    applyMachineConfig(_step_style, amountL, amountR, _machine_width, _machine_height);
    PEN_UP_ANGLE = _pen_up_angle;
    PEN_DOWN_ANGLE = _pen_down_angle;
    PEN_DELAY = _pen_delay;

    /* teleport(0,0); */
    saveConfigToEEPROM();
    printConfig();
  } else if(!strncmp(buffer,"G00 ",4) || !strncmp(buffer,"G01 ",4)
         || !strncmp(buffer,"G0 " ,3) || !strncmp(buffer,"G1 " ,3) ) {
    // line
    processSubcommand();
    float xx, yy, zz;

    if(absolute_mode==1) {
      xx=posx;
      yy=posy;
      zz=posz;
    } else {
      xx=0;
      yy=0;
      zz=0;
    }

    char *ptr=buffer;
    while(ptr && ptr<buffer+sofar && strlen(ptr)) {
      ptr=strchr(ptr,' ')+1;
      switch(*ptr) {
      case 'X': xx=atof(ptr+1)*mode_scale;  break;
      case 'Y': yy=atof(ptr+1)*mode_scale;  break;
      case 'Z': zz=atof(ptr+1);  break;
      case 'F': setFeedRate(atof(ptr+1));  break;
      }
    }

    if(absolute_mode==0) {
      xx+=posx;
      yy+=posy;
      zz+=posz;
    }

    line_safe(xx,yy,zz);
  } else if(!strncmp(buffer,"G02 ",4) || !strncmp(buffer,"G2 " ,3)
         || !strncmp(buffer,"G03 ",4) || !strncmp(buffer,"G3 " ,3)) {
    // arc
    processSubcommand();
    float xx, yy, zz;
    float dd = (!strncmp(buffer,"G02",3) || !strncmp(buffer,"G2",2)) ? -1 : 1;
    float ii = 0;
    float jj = 0;

    if(absolute_mode==1) {
      xx=posx;
      yy=posy;
      zz=posz;
    } else {
      xx=0;
      yy=0;
      zz=0;
    }

    char *ptr=buffer;
    while(ptr && ptr<buffer+sofar && strlen(ptr)) {
      ptr=strchr(ptr,' ')+1;
      switch(*ptr) {
      case 'I': ii=atof(ptr+1)*mode_scale;  break;
      case 'J': jj=atof(ptr+1)*mode_scale;  break;
      case 'X': xx=atof(ptr+1)*mode_scale;  break;
      case 'Y': yy=atof(ptr+1)*mode_scale;  break;
      case 'Z': zz=atof(ptr+1);  break;
      case 'F': setFeedRate(atof(ptr+1));  break;
      }
    }

    if(absolute_mode==0) {
      xx+=posx;
      yy+=posy;
      zz+=posz;
    }

    arc(posx+ii,posy+jj,xx,yy,zz,dd);
  } else if(!strncmp(buffer,"G04 ",4) || !strncmp(buffer,"G4 ",3)) {
    // dwell
    long xx=0;

    char *ptr=buffer;
    while(ptr && ptr<buffer+sofar && strlen(ptr)) {
      ptr=strchr(ptr,' ')+1;
      switch(*ptr) {
      case 'X':
      case 'U':
      case 'P': xx=atoi(ptr+1);  break;
      }
    }

    delay(xx);
  } else if(!strncmp(buffer,"D00 ",4)) {
    // move one motor
    char *ptr=strchr(buffer,' ')+1;
    int amount = atoi(ptr+1);
    int i, dir;
    if(*ptr == m1d) {
      dir = amount < 0 ? M1_REEL_IN : M1_REEL_OUT;
      amount=abs(amount);
      for(i=0;i<amount;++i) {  m1->step(1,dir);  delay(2);  }
    } else if(*ptr == m2d) {
      dir = amount < 0 ? M2_REEL_IN : M2_REEL_OUT;
      amount = abs(amount);
      for(i=0;i<amount;++i) {  m2->step(1,dir);  delay(2);  }
    }
  } else {
    if(processSubcommand()==0) {
      Serial.print(F("Invalid command '"));
      Serial.print(buffer);
      Serial.println(F("'"));
    }
  }
}


//------------------------------------------------------------------------------
void setup() {

  AFMS0.begin();

  // initialize the scale
  strcpy(mode_name,"mm");
  mode_scale = 0.1;

  LoadConfigFromEEPROM();

  sofar = 0; // initialize the read buffer
  Serial.begin(BAUD);
  Serial.print(F("\n\nHELLO WORLD!"));

  s1.attach(SERVO_PIN);

  // turn on the pull up resistor
  digitalWrite(L_PIN, HIGH);
  digitalWrite(R_PIN, HIGH);

  help();

  teleport(0,0);
  velx = 0;
  velx = 0;
  // setPenAngle(PEN_UP_ANGLE);

  Serial.print(F("> "));
}


//------------------------------------------------------------------------------
void loop() {
  // See: http://www.marginallyclever.com/2011/10/controlling-your-arduino-through-the-serial-monitor/
  // listen for serial commands
  while(Serial.available() > 0) {
    buffer[sofar++] = Serial.read();
    if(buffer[sofar - 1] == ';') break;  // in case there are multiple instructions
  }

  // if we hit a semi-colon, assume end of instruction.
  if (sofar > 0 && buffer[sofar - 1] == ';') {
    buffer[sofar] = 0;
    // echo confirmation
    // Serial.println(F(buffer));
    processCommand();
    sofar = 0;
    Serial.print(F("> "));
  }
}


/**
 * This file is part of DrawbotGUI.
 *
 * DrawbotGUI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DrawbotGUI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */
