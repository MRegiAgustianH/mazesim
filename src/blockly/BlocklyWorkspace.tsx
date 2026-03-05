import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import 'blockly/blocks'; // Import default standard blocks
import { javascriptGenerator } from 'blockly/javascript';
import { registerBlocks } from './blocks';
import { arduinoGenerator } from './arduinoGenerator';
import { setupJsGenerator } from './javascriptGenerator';
import { useStore } from '../store/useStore';
import * as En from 'blockly/msg/en';
import { CrossTabCopyPaste } from '@blockly/plugin-cross-tab-copy-paste';

// Set language
// @ts-ignore
Blockly.setLocale(En);

// Define standard tools toolbox + custom category
const toolboxInfo = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Basic Functions',
      colour: 120,
      contents: [
        { kind: 'block', type: 'mrb_setup' },
        { kind: 'block', type: 'mrb_start' },
        { kind: 'block', type: 'mrb_motor' },
        { kind: 'block', type: 'mrb_lineTrace' },
        { kind: 'block', type: 'mrb_tright' },
        { kind: 'block', type: 'mrb_tleft' },
        { kind: 'block', type: 'mrb_rl' },
        { kind: 'block', type: 'mrb_ll' },
        { kind: 'block', type: 'mrb_prl' },
        { kind: 'block', type: 'mrb_pll' },
        { kind: 'block', type: 'mrb_rls' },
        { kind: 'block', type: 'mrb_lls' },
        { kind: 'block', type: 'mrb_rld' },
        { kind: 'block', type: 'mrb_lld' },
        { kind: 'block', type: 'mrb_ld' },
        { kind: 'block', type: 'mrb_trigger' },
        { kind: 'block', type: 'mrb_sac' },
        { kind: 'block', type: 'mrb_pickup' },
        { kind: 'block', type: 'mrb_putdown' },
        { kind: 'block', type: 'mrb_blink' },
        { kind: 'block', type: 'mrb_lc' },
      ],
    }
  ],
};

export const BlocklyWorkspace: React.FC = () => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const blocklyInstance = useRef<Blockly.WorkspaceSvg | null>(null);
  const setArduinoCode = useStore((state) => state.setArduinoCode);
  const setJsCode = useStore((state) => state.setJsCode);
  const setWorkspaceXml = useStore((state) => state.setWorkspaceXml);

  useEffect(() => {
    // Register custom elements
    registerBlocks();
    setupJsGenerator();
    let observer: ResizeObserver | null = null;

    // Vite tree-shakes Blockly context menus. We must force-register them.
    // @ts-ignore
    if (!Blockly.ContextMenuRegistry.registry.getItem('blockDuplicate')) {
      // @ts-ignore
      Blockly.ContextMenuRegistry.registry.register(Blockly.ContextMenuItems.registerDuplicate());
      // @ts-ignore
      Blockly.ContextMenuRegistry.registry.register(Blockly.ContextMenuItems.registerComment());
      // @ts-ignore
      Blockly.ContextMenuRegistry.registry.register(Blockly.ContextMenuItems.registerDelete());
    }

    if (workspaceRef.current && !blocklyInstance.current) {
      blocklyInstance.current = Blockly.inject(workspaceRef.current, {
        toolbox: toolboxInfo,
        grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
        trashcan: true,
        move: { scrollbars: true, drag: true, wheel: true },
        zoom: { controls: true, wheel: true },
        collapse: true,
        comments: true,
        disable: true
      });

      // Enable cross tab copy paste (Ctrl+C, Ctrl+V for multiple/separated blocks)
      const plugin = new CrossTabCopyPaste();
      plugin.init({ contextMenu: true, shortcut: true }, () => blocklyInstance.current!);

      // Force layout recalculations on flex-box/CSS dimension changes
      observer = new ResizeObserver(() => {
        if (blocklyInstance.current) {
          Blockly.svgResize(blocklyInstance.current);

          // Force flyout recount to clear ghost scrollbars if any
          const flyout = blocklyInstance.current.getFlyout();
          if (flyout && !flyout.isVisible()) {
            flyout.hide();
          }
        }
      });
      observer.observe(workspaceRef.current);

      // Update generated code when workspace changes
      blocklyInstance.current.addChangeListener((event) => {
        if (!event.isUiEvent && blocklyInstance.current) {
          const jsCode = javascriptGenerator.workspaceToCode(blocklyInstance.current);
          const inoCode = arduinoGenerator.workspaceToCode(blocklyInstance.current);
          setJsCode(jsCode);
          setArduinoCode(inoCode);

          const xmlDom = Blockly.Xml.workspaceToDom(blocklyInstance.current);
          const xmlText = Blockly.Xml.domToText(xmlDom);
          setWorkspaceXml(xmlText);
        }
      });

      // Load initial layout matching Arduino template
      const savedXml = localStorage.getItem('blockly_workspace_save');
      const defaultXml = `
                <xml>
                  <block type="mrb_setup" x="50" y="50" deletable="false" movable="false">
                    <next>
                      <block type="mrb_start" deletable="false" movable="false">
                        <next>
                          <block type="mrb_motor">
                            <field name="L_SPEED">80</field>
                            <field name="R_SPEED">80</field>
                            <field name="DELAY">300</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </xml>
            `;
      const xmlToLoad = savedXml || defaultXml;
      Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xmlToLoad), blocklyInstance.current);
      if (savedXml) {
        setWorkspaceXml(savedXml);
      }
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      // Cleanup if needed
      // blocklyInstance.current?.dispose(); // Strict mode might cause issues if disposed immediately
    };
  }, []);

  return <div ref={workspaceRef} className="w-full h-full absolute inset-0" />;
};
