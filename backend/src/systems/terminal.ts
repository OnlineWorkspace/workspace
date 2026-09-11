import readline from "node:readline/promises";
import {BoxRenderable, Text, TextRenderable, type CliRenderer, type RGBA, hexToRgb, InputRenderable} from "@opentui/core";
import chalk from "chalk";
import type {Instance} from "../index.ts";
import {LogMessageStyle, LogType} from "../log.ts";
import System from "../system.ts";
import {WorkspacesFeatureFlags} from "./configuration.ts";
import {WorkspacesEvent} from "./events.ts";
import createReactionaryValue from "../utils/reactionaryValue.js";

const COMPACT_LOG_TYPE = false;

const BACKGROUND_COLOR: [number, number, number] = [15, 15, 20];
const BORDER_COLOR: [number, number, number] = [60, 60, 75];
const TEXT_COLOR: [number, number, number] = [220, 220, 225];
const EMPHASIZED_TEXT_COLOR: [number, number, number] = [242, 106, 141];
const MESSAGE_TYPE_COLORS: { [type in LogType]: [number, number, number] } = {
  [LogType.INFO]: [58, 134, 255],
  [LogType.WARNING]: [247, 184, 1],
  [LogType.ERROR]: [240, 80, 80],
  [LogType.SUCCESS]: [6, 214, 160],
  [LogType.DEBUG]: [131, 56, 236],
};
const MESSAGE_LEVEL_COLOR: [number, number, number] = [250, 163, 7];

export default class TerminalUISystem extends System {
  private renderer!: CliRenderer;
  private readlineInterface!: readline.Interface;
  private inputAvailable = false;
  private pendingPrompt?: (answer: string) => void;
  private promptContainer!: BoxRenderable;

  constructor(instance: Instance) {
    super("terminal_ui", instance);
  }

  async prompt(
    query: string,
    options?: {
      presetInputs: string[];
      allowAlternativeInputs:
        | { type: "string"; maxLength?: number; minLength?: number }
        | { type: "number"; min?: number; max?: number; allowDecimals?: boolean };
    },
  ): Promise<string | undefined> {
    if (!this.inputAvailable || this.pendingPrompt) {
      this.log.error("Cannot create a prompt when another prompt is on-going.");

      return undefined;
    }

    const self = this;

    if (this.instance.sys.configuration.hasFeature(WorkspacesFeatureFlags.ExperimentalTerminalGui)) {
      return new Promise<string | undefined>((resolve) => {
        let currentResponse: string = "";
        let currentResponseIdx = createReactionaryValue<number>(0);
        const content = new BoxRenderable(this.renderer, {
          focusable: true,
          flexDirection: "row", gap: 1, onKeyDown(key) {
            if (key.name === "up") {
              // if (currentResponseIdx > (options?.presetInputs || []).length) {
              //   currentResponseIdx = 0;
              // } else {
              //   currentResponseIdx++
              // }
            }
          }
        });
        const promptText = new TextRenderable(this.renderer, {content: query});
        const promptColon = new TextRenderable(this.renderer, {content: ":"});
        const presetInputContainer = new BoxRenderable(this.renderer, {flexDirection: "column"});

        if (options?.presetInputs) {
          for (let presetIdx = 0; presetIdx < options.presetInputs.length; presetIdx = 0) {
            const presetValue = options.presetInputs[presetIdx];
            const guiPreset = new TextRenderable(this.renderer, {content: presetValue})
            presetInputContainer.add(guiPreset)

            currentResponseIdx.on((val) => {
              if (val === presetIdx) {
                guiPreset.bg = "#aaaf"
              } else {
                guiPreset.bg = "#000f"
              }
            })
          }
        }

        if (options?.allowAlternativeInputs) {
          const alternativeInput = new InputRenderable(this.renderer, {
            onSubmit() {
              resolve(alternativeInput.value)
            }
          })

          presetInputContainer.add(alternativeInput);
        }

        content.add(promptText);
        content.add(promptColon);
        content.add(presetInputContainer);
        this.promptContainer.add(content);
      });
    } else {
      this.instance.log.system.info(query);

      const answer = await new Promise<string>((resolve) => {
        this.pendingPrompt = resolve;
      });

      return answer.trim();
    }
  }

  /**
   Feed a submitted input line through any active {@link prompt}.
   @returns `true` if the line was consumed as a prompt answer
   */
  private resolvePendingPrompt(line: string): boolean {
    if (!this.pendingPrompt) return false;

    const resolve = this.pendingPrompt;
    this.pendingPrompt = undefined;
    resolve(line);

    return true;
  }

  override async startup(): Promise<boolean> {
    if (!process.stdout) return false;

    await super.startup();

    this.instance.sys.event.on(WorkspacesEvent.BeforeShutdown, () => {
      this.stop();
    });

    if (
      this.instance.sys.configuration.hasFeature(WorkspacesFeatureFlags.ExperimentalTerminalGui) ||
      this.instance.sys.configuration.hasFeature(WorkspacesFeatureFlags.ClearTerminalConsoleOnStartup)
    ) {
      console.clear();
    }

    if (!this.instance.sys.configuration.hasFeature(WorkspacesFeatureFlags.ExperimentalTerminalGui)) {
      function addLogMessage(log: { type: LogType; level: string; message: string }) {
        let consoleLogOutput: string = "";
        const currentTypeColor = MESSAGE_TYPE_COLORS[log.type];

        if (COMPACT_LOG_TYPE) {
          consoleLogOutput += chalk.rgb(...currentTypeColor)("▌");
        } else {
          let typeString = "";

          switch (log.type) {
            case LogType.INFO:
              typeString = `${"INF"}`;
              break;
            case LogType.WARNING:
              typeString = `${"WAR"}`;
              break;
            case LogType.ERROR:
              typeString = `${"ERR"}`;
              break;
            case LogType.SUCCESS:
              typeString = `${"SUC"}`;
              break;
            case LogType.DEBUG:
              typeString = `${"DBG"}`;
              break;
          }

          consoleLogOutput += chalk.rgb(...currentTypeColor)(`${typeString} `);
        }

        consoleLogOutput += chalk.rgb(...MESSAGE_LEVEL_COLOR)(`${log.level.padEnd(16)} `);

        const styledSegments = log.message.split("%");
        let currentMessageStyle: LogMessageStyle = LogMessageStyle.NORMAL;
        let customColorDef: [number, number, number] | undefined;
        for (let segmentIdx = 0; segmentIdx < styledSegments.length; segmentIdx++) {
          const segmentContent = styledSegments[segmentIdx];

          if (segmentContent === "") continue;

          switch (`%${segmentContent}%`) {
            case LogMessageStyle.EMPHASIZED: {
              currentMessageStyle = LogMessageStyle.EMPHASIZED;
              continue;
            }
            case LogMessageStyle.NORMAL: {
              currentMessageStyle = LogMessageStyle.NORMAL;
              continue;
            }
            case LogMessageStyle.CUSTOM: {
              currentMessageStyle = LogMessageStyle.CUSTOM;
              continue;
            }
            case LogMessageStyle.END_CUSTOM: {
              currentMessageStyle = LogMessageStyle.END_CUSTOM;
              const colorValSegments = styledSegments[segmentIdx - 1].split(",").map((val) => Number(val));

              if (colorValSegments.length === 4) {
                customColorDef = [colorValSegments[0], colorValSegments[1], colorValSegments[2]];
              }

              continue;
            }
            case LogMessageStyle.RESET:
              currentMessageStyle = LogMessageStyle.RESET;
              continue;
          }

          switch (currentMessageStyle) {
            case LogMessageStyle.RESET:
            case LogMessageStyle.NORMAL:
              consoleLogOutput += chalk.rgb(...TEXT_COLOR)(segmentContent);
              break;
            case LogMessageStyle.EMPHASIZED:
              consoleLogOutput += chalk.rgb(...EMPHASIZED_TEXT_COLOR)(segmentContent);
              break;
            case LogMessageStyle.END_CUSTOM:
              if (!customColorDef) {
                consoleLogOutput += chalk.bold.red(`UNABLE TO PARSE CUSTOM COLOR '${customColorDef}'`);
              } else {
                consoleLogOutput += chalk.rgb(...customColorDef)(segmentContent);
              }
              break;
          }
        }
        // @ts-ignore
        global.consoleBackup.log(consoleLogOutput);
      }

      for (const message of this.instance.log.allLogHistory) {
        addLogMessage(message);
      }

      this.instance.log._internal_onNewMessageListeners.push((message) => {
        addLogMessage(message);
      });

      this.readlineInterface = readline.createInterface(process.stdin, process.stdout);

      this.inputAvailable = true;

      // @ts-ignore
      this.readlineInterface.addListener("line", (data: string) => {
        if (this.resolvePendingPrompt(data)) return;
        this.instance.sys.consoleCommands.executeCommandFromString(data);
      });

      // @ts-ignore
      this.readlineInterface.on("SIGINT", () => {
        this.instance.shutdown("Console Admin Ctrl+C");
      });

      // @ts-ignore
      this.readlineInterface.on("SIGTERM", () => {
        this.instance.shutdown("SIGTERM");
      });

      return true;
    }

    const {BoxRenderable, ConsolePosition, createCliRenderer, InputRenderable, RGBA, ScrollBoxRenderable, TextRenderable} = await import("@opentui/core");

    const self = this;

    function toRGBA(colorArray: [number, number, number]): RGBA {
      return RGBA.fromInts(...colorArray, 255);
    }

    this.renderer = await createCliRenderer({
      exitOnCtrlC: true,
      consoleOptions: {
        colorDefault: toRGBA(TEXT_COLOR),
        colorInfo: toRGBA(MESSAGE_TYPE_COLORS[LogType.INFO]),
        colorWarn: toRGBA(MESSAGE_TYPE_COLORS[LogType.WARNING]),
        colorError: toRGBA(MESSAGE_TYPE_COLORS[LogType.ERROR]),
        colorDebug: toRGBA(MESSAGE_TYPE_COLORS[LogType.DEBUG]),
        position: ConsolePosition.TOP,
      },
      consoleMode: "disabled",
      onDestroy: async () => {
        await this.instance.shutdown();
      },
    });

    self.renderer.setBackgroundColor(toRGBA(BACKGROUND_COLOR));

    const logContainer = new ScrollBoxRenderable(self.renderer, {
      height: "100%",
      width: "100%",
      border: true,
      borderStyle: "rounded",
      contentOptions: {
        flexDirection: "column",
      },
      focusedBorderColor: toRGBA(BORDER_COLOR),
      borderColor: toRGBA(BORDER_COLOR),
      stickyScroll: true,
      stickyStart: "bottom",
    });

    function addLogMessage(log: { type: LogType; level: string; message: string }) {
      const logEntry = new BoxRenderable(self.renderer, {
        flexDirection: "row",
        flexWrap: "no-wrap",
        flexShrink: 0,
      });
      logContainer.add(logEntry);
      const currentTypeColor = MESSAGE_TYPE_COLORS[log.type];

      if (COMPACT_LOG_TYPE) {
        logEntry.add(
          new TextRenderable(self.renderer, {
            content: "▌",
            fg: toRGBA(currentTypeColor),
          }),
        );
      } else {
        let typeString = "";

        switch (log.type) {
          case LogType.INFO:
            typeString = `${"INF"}`;
            break;
          case LogType.WARNING:
            typeString = `${"WAR"}`;
            break;
          case LogType.ERROR:
            typeString = `${"ERR"}`;
            break;
          case LogType.SUCCESS:
            typeString = `${"SUC"}`;
            break;
          case LogType.DEBUG:
            typeString = `${"DBG"}`;
            break;
        }

        logEntry.add(
          new TextRenderable(self.renderer, {
            content: `${typeString}`,
            fg: toRGBA(currentTypeColor),
            paddingRight: 1,
            flexShrink: 0,
          }),
        );
      }

      logEntry.add(
        new TextRenderable(self.renderer, {
          content: log.level.padEnd(16),
          fg: toRGBA(MESSAGE_LEVEL_COLOR),
          paddingRight: 1,
          flexShrink: 0,
        }),
      );

      const logMessageContainer = new BoxRenderable(self.renderer, {
        flexDirection: "row",
        flexWrap: "wrap",
      });
      logEntry.add(logMessageContainer);

      const styledSegments = log.message.split("%");
      let currentMessageStyle: LogMessageStyle = LogMessageStyle.NORMAL;
      let customColorDef: RGBA | undefined;
      for (let segmentIdx = 0; segmentIdx < styledSegments.length; segmentIdx++) {
        const segmentContent = styledSegments[segmentIdx];

        if (segmentContent === "") continue;

        switch (`%${segmentContent}%`) {
          case LogMessageStyle.EMPHASIZED: {
            currentMessageStyle = LogMessageStyle.EMPHASIZED;
            continue;
          }
          case LogMessageStyle.NORMAL: {
            currentMessageStyle = LogMessageStyle.NORMAL;
            continue;
          }
          case LogMessageStyle.CUSTOM: {
            currentMessageStyle = LogMessageStyle.CUSTOM;
            continue;
          }
          case LogMessageStyle.END_CUSTOM: {
            currentMessageStyle = LogMessageStyle.END_CUSTOM;
            const colorValSegments = styledSegments[segmentIdx - 1].split(",").map((val) => Number(val));

            if (colorValSegments.length === 4) {
              customColorDef = RGBA.fromInts(colorValSegments[0], colorValSegments[1], colorValSegments[2], colorValSegments[3]);
            }

            continue;
          }
          case LogMessageStyle.RESET:
            currentMessageStyle = LogMessageStyle.RESET;
            continue;
        }

        switch (currentMessageStyle) {
          case LogMessageStyle.RESET:
          case LogMessageStyle.NORMAL:
            logMessageContainer.add(
              new TextRenderable(self.renderer, {
                content: segmentContent,
                fg: toRGBA(TEXT_COLOR),
                bg: toRGBA(BACKGROUND_COLOR),
              }),
            );
            break;
          case LogMessageStyle.EMPHASIZED:
            logMessageContainer.add(
              new TextRenderable(self.renderer, {
                content: segmentContent,
                fg: toRGBA(EMPHASIZED_TEXT_COLOR),
                bg: toRGBA(BACKGROUND_COLOR),
              }),
            );
            break;
          case LogMessageStyle.END_CUSTOM:
            logMessageContainer.add(
              new TextRenderable(self.renderer, {
                content: segmentContent,
                fg: customColorDef,
                bg: toRGBA(BACKGROUND_COLOR),
              }),
            );
            break;
        }
      }
    }

    for (const message of self.instance.log.allLogHistory) {
      addLogMessage(message);
    }

    self.instance.log._internal_onNewMessageListeners.push((message) => {
      addLogMessage(message);
    });

    self.renderer.root.add(logContainer);

    const commandInputContainer = new BoxRenderable(self.renderer, {
      height: 1,
      width: "100%",
      flexDirection: "row",
      gap: 1,
    });

    self.renderer.root.add(commandInputContainer);

    const PROMPT_STRING = `Online Workspace ${self.instance.versionString} >`;

    const promptMessage = new TextRenderable(self.renderer, {
      content: PROMPT_STRING,
      fg: RGBA.fromInts(242, 106, 141, 255),
      marginLeft: 1,
      width: PROMPT_STRING.length,
    });

    commandInputContainer.add(promptMessage);

    const commandInput = new InputRenderable(self.renderer, {
      placeholder: "Click to start typing...",
      buffered: true,
      flexGrow: 1,

      onKeyDown(e) {
        if (e.name === "return") {
          const trimmedContent = commandInput.plainText.trim();
          if (self.resolvePendingPrompt(trimmedContent)) {
            commandInput.value = "";
            commandInput.requestRender();
            return;
          }
          if (!trimmedContent) return;
          self.instance.sys.consoleCommands.executeCommandFromString(trimmedContent);
          commandInput.value = "";
        }
        commandInput.requestRender();
      },
    });
    commandInput.focus();
    commandInputContainer.add(commandInput);

    self.inputAvailable = true;

    self.promptContainer = new BoxRenderable(self.renderer, {border: false, flexDirection: "column"});
    self.renderer.root.add(self.promptContainer);

    return true;
  }

  override stop(): boolean {
    this.renderer?.destroy?.();

    return true;
  }
}
