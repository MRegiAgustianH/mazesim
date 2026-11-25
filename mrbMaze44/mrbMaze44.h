#ifndef mrbMaze44_h
#define mrbMaze44_h

#include <Arduino.h>

class mrbMaze44{
	public:
	mrbMaze44();
	void mazeSetup();
	void welcomeScreen();
	void motorBalance(int l, int r);
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
	void pu(int gripPower, int liftHigh, int speed, int dly);
	void pd(int speed, int dly);
	void end();
};

#endif