#include <mrbMaze44.h>
mrbMaze44 my;

void setup() {
  my.mazeSetup();
  // my.welcomeScreen();
  my.motorBalance(0,0);
  my.sensorSet(300, 300, 300, 300, 300, 300, 300, 300);
  my.pidSet(28,8,8);
  my.lineColour(0);     // 0 for black line, 1 for white line
  my.start();
}

/*
  my.pu(100,100,3,300);  gripPower, liftHigh, speed, delay
  my.pd(3,300);      speed, delay
*/

void loop() {
  // start code here ! -------------------------
  my.motor(80,80,300);



  // end of code -------------------------------
  my.end();
}
