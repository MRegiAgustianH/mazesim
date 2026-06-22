#include <mrbMaze42.h>
mrbMaze42 my;

void setup() {
  my.mazeSetup();
  my.welcomeScreen();
  my.sensorSet(300, 300, 300, 300, 300, 300, 300, 300);
  my.pidSet(28,8,8);
  my.lineColour(0);     // 0 for black line, 1 for white line
  my.start();
}

/*
  my.pickup(100,100,3,300);	gripPower, liftHigh, speed, delay
  my.putdown(3,300);			speed, delay
*/

void loop() {
  // start code here ! -------------------------
  my.motor(80,80,300);



  // end of code -------------------------------
  my.end();
}
