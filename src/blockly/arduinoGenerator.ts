import * as Blockly from 'blockly/core';

export const arduinoGenerator = new Blockly.Generator('Arduino');

arduinoGenerator.finish = function (code: string) {
  return `#include <mrbMaze42.h>
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
${code}


  // end of code -------------------------------
  my.end();
}`;
};

arduinoGenerator.scrub_ = function (block: Blockly.Block, code: string, thisOnly?: boolean): string {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  const nextCode = thisOnly ? '' : arduinoGenerator.blockToCode(nextBlock);
  return code + nextCode;
};

const getNumber = (_block: any, field: string) => _block.getFieldValue(field);

// Because these blocks are the root nodes connected to everyone else in the workspace tree, 
// they MUST return at least some valid string/comment so Blockly doesn't break the code generation chain.
// By returning a simple space, we ensure the next block is safely appended.
arduinoGenerator.forBlock['mrb_setup'] = (_block: any) => `\n`;
arduinoGenerator.forBlock['mrb_start'] = (_block: any) => `\n`;
arduinoGenerator.forBlock['mrb_blink'] = (_block: any) => `  my.blink();\n`;
arduinoGenerator.forBlock['mrb_lc'] = (_block: any) => `  my.lineColour(${getNumber(_block, 'COLOR')});\n`;

arduinoGenerator.forBlock['mrb_motor'] = (_block: any) =>
  `  my.motor(${getNumber(_block, 'L_SPEED')}, ${getNumber(_block, 'R_SPEED')}, ${getNumber(_block, 'DELAY')});\n`;

arduinoGenerator.forBlock['mrb_tright'] = (_block: any) =>
  `  my.tright(${getNumber(_block, 'POWER')});\n`;

arduinoGenerator.forBlock['mrb_tleft'] = (_block: any) =>
  `  my.tleft(${getNumber(_block, 'POWER')});\n`;

arduinoGenerator.forBlock['mrb_ld'] = (_block: any) =>
  `  my.ld(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'DELAY')});\n`;

arduinoGenerator.forBlock['mrb_lineTrace'] = (_block: any) =>
  `  my.lineTrace(${getNumber(_block, 'POWER')});\n`;

arduinoGenerator.forBlock['mrb_lineTraceSmooth'] = (_block: any) =>
  `  my.lineTraceSmooth(${getNumber(_block, 'POWER')});\n`;

arduinoGenerator.forBlock['mrb_rl'] = (_block: any) =>
  `  my.rl(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;

arduinoGenerator.forBlock['mrb_ll'] = (_block: any) =>
  `  my.ll(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;

arduinoGenerator.forBlock['mrb_prl'] = (_block: any) =>
  `  my.prl(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;

arduinoGenerator.forBlock['mrb_pll'] = (_block: any) =>
  `  my.pll(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;

arduinoGenerator.forBlock['mrb_rls'] = (_block: any) =>
  `  my.rls(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')});\n`;

arduinoGenerator.forBlock['mrb_lls'] = (_block: any) =>
  `  my.lls(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')});\n`;

arduinoGenerator.forBlock['mrb_rld'] = (_block: any) =>
  `  my.rld(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')}, ${getNumber(_block, 'DELAY')});\n`;

arduinoGenerator.forBlock['mrb_lld'] = (_block: any) =>
  `  my.lld(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')}, ${getNumber(_block, 'DELAY')});\n`;

arduinoGenerator.forBlock['mrb_trigger'] = (_block: any) =>
  `  my.trigger(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')});\n`;

arduinoGenerator.forBlock['mrb_sac'] = (_block: any) =>
  `  my.sac(${getNumber(_block, 'POWER')});\n`;

arduinoGenerator.forBlock['mrb_pickup'] = (_block: any) =>
  `  my.pickup(${getNumber(_block, 'GRIP')}, ${getNumber(_block, 'LIFT')}, ${getNumber(_block, 'SPEED')}, ${getNumber(_block, 'DELAY')});\n`;

arduinoGenerator.forBlock['mrb_putdown'] = (_block: any) =>
  `  my.putdown(${getNumber(_block, 'SPEED')}, ${getNumber(_block, 'DELAY')});\n`;
