import * as Blockly from 'blockly';

export const registerBlocks = () => {
    // ------------------------------------------------------------------
    // Setup & Utility
    Blockly.Blocks['mrb_setup'] = {
        init: function () {
            this.appendDummyInput().appendField("mrbMaze42 Setup");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(120);
        }
    };
    Blockly.Blocks['mrb_start'] = {
        init: function () {
            this.appendDummyInput().appendField("Wait for Start Button");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(120);
        }
    };
    Blockly.Blocks['mrb_blink'] = {
        init: function () {
            this.appendDummyInput().appendField("Blink LED");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(120);
        }
    };
    Blockly.Blocks['mrb_lc'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Line Color (lc):")
                .appendField(new Blockly.FieldDropdown([["Black (0)", "0"], ["White (1)", "1"]]), "COLOR");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(120);
        }
    };
    Blockly.Blocks['mrb_delay'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Delay (ms):")
                .appendField(new Blockly.FieldNumber(500, 0), "DELAY");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(120);
        }
    };

    // ------------------------------------------------------------------
    // Basic Movement
    Blockly.Blocks['mrb_motor'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Motor L:")
                .appendField(new Blockly.FieldNumber(100, -255, 255), "L_SPEED")
                .appendField(" R:")
                .appendField(new Blockly.FieldNumber(100, -255, 255), "R_SPEED")
                .appendField(" Wait(ms):")
                .appendField(new Blockly.FieldNumber(0, 0), "DELAY");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
        }
    };
    Blockly.Blocks['mrb_tright'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Turn Right (tright) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
        }
    };
    Blockly.Blocks['mrb_tleft'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Turn Left (tleft) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
        }
    };
    Blockly.Blocks['mrb_ld'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Line Delay (ld) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Delay:")
                .appendField(new Blockly.FieldNumber(100, 0), "DELAY");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
        }
    };

    // ------------------------------------------------------------------
    // Line Following
    Blockly.Blocks['mrb_lineTrace'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Line Trace Pwr:")
                .appendField(new Blockly.FieldNumber(150, 0, 255), "POWER");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(210);
        }
    };
    Blockly.Blocks['mrb_lineTraceSmooth'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Line Trace Smooth Pwr:")
                .appendField(new Blockly.FieldNumber(150, 0, 255), "POWER");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(210);
        }
    };

    // ------------------------------------------------------------------
    // Intersections / Turns Node
    Blockly.Blocks['mrb_rl'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Right Line (rl) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(280);
        }
    };
    Blockly.Blocks['mrb_ll'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Left Line (ll) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(280);
        }
    };
    Blockly.Blocks['mrb_prl'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Past Right Line (prl) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(280);
        }
    };
    Blockly.Blocks['mrb_pll'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Past Left Line (pll) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(280);
        }
    };
    Blockly.Blocks['mrb_rls'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Right Line Sensor (rls) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Sensor:")
                .appendField(new Blockly.FieldNumber(7, 1, 88), "SENSOR")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(280);
        }
    };
    Blockly.Blocks['mrb_lls'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Left Line Sensor (lls) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Sensor:")
                .appendField(new Blockly.FieldNumber(2, 1, 88), "SENSOR")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(280);
        }
    };
    Blockly.Blocks['mrb_rld'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Right Line Delay (rld) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Sensor:")
                .appendField(new Blockly.FieldNumber(7, 1, 88), "SENSOR")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP")
                .appendField(" Dly:")
                .appendField(new Blockly.FieldNumber(100, 0), "DELAY");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(280);
        }
    };
    Blockly.Blocks['mrb_lld'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Left Line Delay (lld) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Sensor:")
                .appendField(new Blockly.FieldNumber(2, 1, 88), "SENSOR")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP")
                .appendField(" Dly:")
                .appendField(new Blockly.FieldNumber(100, 0), "DELAY");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(280);
        }
    };

    // ------------------------------------------------------------------
    // Misc Actions
    Blockly.Blocks['mrb_trigger'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Trigger Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER")
                .appendField(" Sensor:")
                .appendField(new Blockly.FieldNumber(1, 1, 88), "SENSOR")
                .appendField(" Step:")
                .appendField(new Blockly.FieldNumber(100, 1), "STEP");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(260);
        }
    };
    Blockly.Blocks['mrb_sac'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Stop at all Colors (sac) Pwr:")
                .appendField(new Blockly.FieldNumber(100, 0, 255), "POWER");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(260);
        }
    };
    Blockly.Blocks['mrb_pickup'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Pickup Arm Grip:")
                .appendField(new Blockly.FieldNumber(100, 0), "GRIP")
                .appendField(" Lift:")
                .appendField(new Blockly.FieldNumber(100, 0), "LIFT")
                .appendField(" Spd:")
                .appendField(new Blockly.FieldNumber(3, 1), "SPEED")
                .appendField(" Dly:")
                .appendField(new Blockly.FieldNumber(300, 0), "DELAY");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(60);
        }
    };
    Blockly.Blocks['mrb_putdown'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Putdown Arm Spd:")
                .appendField(new Blockly.FieldNumber(3, 1), "SPEED")
                .appendField(" Dly:")
                .appendField(new Blockly.FieldNumber(300, 0), "DELAY");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(60);
        }
    };
};
