import type {CommandModule} from "yargs";

const command: CommandModule = {
  command: "make_operator <username>",
  aliases: ["op"],
  describe: "Grant a user administrator permissions",
  async handler(args) {
    const username = args.username as string;
    const log = INSTANCE.log.system

    const user = await INSTANCE.sys.users.getUserByUsername(username);

    if (!user) {
      log.error(`Invalid user '${log.emphasis(username)}'`);
      return;
    }

    const result = await user.setIsAdministrator(true);

    if (result) {
      log.success(`User '${log.emphasis(username)}' was promoted to administrator successfully!`);
    } else {
      log.error(`Failed to make user '${log.emphasis(username)}' an administrator!`);
    }
  }
};

export default command;
