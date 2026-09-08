import type {CommandModule} from "yargs";

const command: CommandModule = {
  command: "application <appid> <action>",
  aliases: ["app"],
  describe: "Manage an application",
  async handler(args) {
    const appId = args.appid as string;
    const log = INSTANCE.log.system

    if (!INSTANCE.sys.applications.availableApplications.find(a => a.manifest?.id === appId)) {
      log.warning(`No such application with id ${log.emphasis(appId)}`)
      return;
    }

    switch (args.action) {
      case "uninstall": {
        if (await INSTANCE.sys.applications.uninstallApplication(appId)) {
          log.success(`Uninstalled application ${log.emphasis(appId)}`);
        } else {
          log.error(`Failed to uninstall application ${log.emphasis(appId)}`);
        }
        break;
      }
      case "enable": {
        if (await INSTANCE.sys.applications.enableApplication(appId)) {
          log.success(`Enabled application ${log.emphasis(appId)}`);
        } else {
          log.error(`Failed to enable application ${log.emphasis(appId)}`);
        }
        break;
      }
      case "disable": {
        if (await INSTANCE.sys.applications.disableApplication(appId)) {
          log.success(`Disabled application ${log.emphasis(appId)}`);
        } else {
          log.error(`Failed to disable application ${log.emphasis(appId)}`);
        }
        break;
      }
      case "status": {
        const status = await INSTANCE.sys.applications.getApplicationStatus(appId)

        if (status.installed) {
          log.info(`application ${log.emphasis(appId)} is ${status.enabled ? "enabled" : "disabled"}`)
        } else {
          log.info(`no application with id ${log.emphasis(appId)} is installed.`)
        }
        break;
      }
    }
  },
};

export default command;
