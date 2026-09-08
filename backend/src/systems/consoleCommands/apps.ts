import type {CommandModule} from "yargs";

const command: CommandModule = {
  command: "applications",
  aliases: ["apps"],
  describe: "List installed applications",
  async handler() {
    const log = INSTANCE.log.system

    for (const app of INSTANCE.sys.applications.availableApplications) {
      log.info(`application ${log.emphasis(app.manifest?.id || "")} is ${app.enabled ? "enabled" : "disabled"}`)
    }
  }
};

export default command;
