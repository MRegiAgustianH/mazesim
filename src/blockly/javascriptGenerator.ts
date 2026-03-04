import { javascriptGenerator } from 'blockly/javascript';

export const setupJsGenerator = () => {
    const getNumber = (_block: any, field: string) => _block.getFieldValue(field);

    javascriptGenerator.forBlock['mrb_setup'] = (_block: any) => `await sim.mazeSetup();\n`;
    javascriptGenerator.forBlock['mrb_start'] = (_block: any) => `await sim.waitStart();\n`;
    javascriptGenerator.forBlock['mrb_blink'] = (_block: any) => `await sim.blink();\n`;

    javascriptGenerator.forBlock['mrb_motor'] = (_block: any) =>
        `await sim.motor(${getNumber(_block, 'L_SPEED')}, ${getNumber(_block, 'R_SPEED')}, ${getNumber(_block, 'DELAY')});\n`;

    javascriptGenerator.forBlock['mrb_tright'] = (_block: any) =>
        `await sim.tright(${getNumber(_block, 'POWER')});\n`;

    javascriptGenerator.forBlock['mrb_tleft'] = (_block: any) =>
        `await sim.tleft(${getNumber(_block, 'POWER')});\n`;

    javascriptGenerator.forBlock['mrb_ld'] = (_block: any) =>
        `await sim.ld(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'DELAY')});\n`;

    javascriptGenerator.forBlock['mrb_lineTrace'] = (_block: any) =>
        `await sim.lineTrace(${getNumber(_block, 'POWER')});\n`;

    javascriptGenerator.forBlock['mrb_lineTraceSmooth'] = (_block: any) =>
        `await sim.lineTraceSmooth(${getNumber(_block, 'POWER')});\n`;

    javascriptGenerator.forBlock['mrb_rl'] = (_block: any) =>
        `await sim.rl(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;

    javascriptGenerator.forBlock['mrb_ll'] = (_block: any) =>
        `await sim.ll(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;

    javascriptGenerator.forBlock['mrb_prl'] = (_block: any) =>
        `await sim.prl(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;

    javascriptGenerator.forBlock['mrb_pll'] = (_block: any) =>
        `await sim.pll(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;

    javascriptGenerator.forBlock['mrb_rls'] = (_block: any) =>
        `await sim.rls(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')});\n`;

    javascriptGenerator.forBlock['mrb_lls'] = (_block: any) =>
        `await sim.lls(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')});\n`;

    javascriptGenerator.forBlock['mrb_rld'] = (_block: any) =>
        `await sim.rld(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')}, ${getNumber(_block, 'DELAY')});\n`;

    javascriptGenerator.forBlock['mrb_lld'] = (_block: any) =>
        `await sim.lld(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')}, ${getNumber(_block, 'DELAY')});\n`;

    javascriptGenerator.forBlock['mrb_trigger'] = (_block: any) =>
        `await sim.trigger(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')});\n`;

    javascriptGenerator.forBlock['mrb_sac'] = (_block: any) =>
        `await sim.sac(${getNumber(_block, 'POWER')});\n`;

    javascriptGenerator.forBlock['mrb_pickup'] = (_block: any) =>
        `await sim.pickup(${getNumber(_block, 'GRIP')}, ${getNumber(_block, 'LIFT')}, ${getNumber(_block, 'SPEED')}, ${getNumber(_block, 'DELAY')});\n`;

    javascriptGenerator.forBlock['mrb_putdown'] = (_block: any) =>
        `await sim.putdown(${getNumber(_block, 'SPEED')}, ${getNumber(_block, 'DELAY')});\n`;
};
