import type {CommandModule} from "yargs";

const GIB = 1024 * 1024 * 1024;

const QUOTA_PRESETS: { label: string; bytes: number }[] = [
  {label: "1 GB", bytes: 1 * GIB},
  {label: "4 GB", bytes: 4 * GIB},
  {label: "8 GB (default)", bytes: 8 * GIB},
  {label: "16 GB", bytes: 16 * GIB},
  {label: "64 GB", bytes: 64 * GIB},
];

const command: CommandModule = {
  command: "make_user [username] [password]",
  aliases: ["mkuser"],
  describe: "Create a new user on this instance. Run with no arguments for an interactive wizard.",
  builder: (yargs) =>
    yargs
      .positional("username", {
        type: "string",
        describe: "The username for the new user",
      })
      .positional("password", {
        type: "string",
        describe: "An optional password for the new user",
      }),
  async handler(args) {
    const log = INSTANCE.log.system;

    await INSTANCE.sys.terminal.prompt("Username", {
      presetInputs: [
        "admin",
        "administrator",
        "testuser",
        "testuser2"
      ], allowAlternativeInputs: {type: "string"}
    })
  },
};

export default command;
