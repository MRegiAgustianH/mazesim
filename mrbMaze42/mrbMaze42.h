#ifndef mrbMaze41_h
#define mrbMaze41_h

#include <Arduino.h>

class mrbMaze42{
	public:
	mrbMaze42();
	void mazeSetup();
	void welcomeScreen();
	void start();
	void battTest();
	void sensorSet(int senVal, int senVal2, int senVal3, int senVal4, int senVal5, int senVal6, int senVal7, int senVal8);
	void senTest();
	void motorDrive(int lSpeed, int rSpeed);
	void motor(int lSpeed, int rSpeed, int dly);
	void lineColour(int col);
	void pidSet(int kp, int ki, int kd);
	void lineTrace(float power);
	void lineTraceSmooth(float power);
	void tright(int power);
	void tleft(int power);
	void ld(int power, int dly);
	void trigger(int power, int sensor, int step);
	void sac(int power);
	void rl(int power, int step);
	void ll(int power, int step);
	void prl(int power, int step);
	void pll(int power, int step);
	void rls(int power, int sensor, int step);
	void lls(int power, int sensor, int step);
	void rld(int power, int sensor, int step, int dly);
	void lld(int power, int sensor, int step, int dly);
	void blink();
	void pickup(int gripPower, int liftHigh, int speed, int dly);
	void putdown(int speed, int dly);
	void end();
};

#endif