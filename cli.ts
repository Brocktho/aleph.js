import { bold } from "https://deno.land/std@0.125.0/fmt/colors.ts";
import { basename, resolve } from "https://deno.land/std@0.125.0/path/mod.ts";
import { parse } from "https://deno.land/std@0.125.0/flags/mod.ts";
import { readImportMap } from "./server/config.ts";
import { getFlag } from "./lib/flags.ts";
import { existsDir, findFile } from "./lib/fs.ts";
import log from "./lib/log.ts";
import { serveDir } from "./lib/serve.ts";
import util from "./lib/util.ts";
import { minDenoVersion, VERSION } from "./version.ts";

const commands = {
  "init": "Create a new app",
  "dev": "Start the app in `development` mode",
  "start": "Start the app in `production` mode",
  "compile": "Compile the app into a worker",
  "upgrade": "Upgrade Aleph.js CLI",
};

const helpMessage = `Aleph.js v${VERSION}
The Full-stack Framework in Deno.

Docs: https://alephjs.org/docs
Bugs: https://github.com/alephjs/aleph.js/issues

Usage:
    aleph <command> [...options]

Commands:
    ${
  Object.entries(commands).map(([name, desc]) => `${name.padEnd(15)}${desc}`)
    .join("\n    ")
}

Options:
    -v, --version  Prints version number
    -h, --help     Prints help message
`;

async function main() {
  const { _: args, ...options } = parse(Deno.args);

  // check deno version
  const [major, minor, patch] = minDenoVersion.split(".").map((p) => parseInt(p));
  const [currentMajor, currentMinor, currentPatch] = Deno.version.deno.split(
    ".",
  ).map((p) => parseInt(p));
  if (
    currentMajor < major || (currentMajor === major && currentMinor < minor) ||
    (currentMajor === major && currentMinor === minor && currentPatch < patch)
  ) {
    log.fatal(`Aleph.js requires Deno v${minDenoVersion} or later`);
  }

  // prints aleph.js version
  if (options.v) {
    console.log(`aleph.js v${VERSION}`);
    Deno.exit(0);
  }

  // prints aleph.js and deno version
  if (options.version) {
    const { deno, v8, typescript } = Deno.version;
    console.log([
      `aleph.js ${VERSION}`,
      `deno ${deno}`,
      `v8 ${v8}`,
      `typescript ${typescript}`,
    ].join("\n"));
    Deno.exit(0);
  }

  // prints help message when the command not found
  if (!(args.length > 0 && args[0] in commands)) {
    console.log(helpMessage);
    Deno.exit(0);
  }

  const command = String(args.shift()) as keyof typeof commands;

  // prints command help message
  if (options.h || options.help) {
    const { helpMessage: cmdHelpMessage } = await import(
      `./commands/${command}.ts`
    );
    console.log(commands[command]);
    console.log(cmdHelpMessage);
    Deno.exit(0);
  }

  // invoke `init` command
  if (command === "init") {
    const { default: init } = await import(`./commands/init.ts`);
    await init(options?.template, args[0]);
    return;
  }

  // invoke `upgrade` command
  if (command === "upgrade") {
    const { default: upgrade } = await import(`./commands/upgrade.ts`);
    await upgrade(options.v || options.version || args[0] || "latest");
    return;
  }

  // set log level
  const logLevel = getFlag(options, ["L", "log-level"], "info");
  if (logLevel === "debug") {
    log.setLevel("debug");
  }

  let workingDir: string;
  let importMapFile: string | undefined;
  let denoConfigFile: string | undefined;
  let cliVerison = VERSION;

  // get denoDir
  const p = Deno.run({
    cmd: [Deno.execPath(), "info", "--json"],
    stdout: "piped",
    stderr: "null",
  });
  const output = (new TextDecoder()).decode(await p.output());
  const { denoDir } = JSON.parse(output);
  if (util.isString(denoDir)) {
    Deno.env.set("DENO_DIR", denoDir);
  }
  p.close();

  if (command === "dev" || command === "start") {
    Deno.env.set("ALEPH_PROJECT_PORT", "7070");
    serveDir({ cwd: resolve(String(args[0] || ".")), port: 7070 });
    log.debug(`Proxy project on http://localhost:7070`);
  }

  if (Deno.env.get("ALEPH_DEV")) {
    workingDir = Deno.cwd();
    denoConfigFile = resolve("./deno.json");
    importMapFile = resolve("./import_map.json");
    Deno.env.set("ALEPH_DEV_ROOT", workingDir);
    Deno.env.set("ALEPH_DEV_PORT", "6060");
    serveDir({ cwd: workingDir, port: 6060 });
    log.debug(`Proxy https://deno.land/x/aleph on http://localhost:6060`);
  } else {
    workingDir = resolve(String(args[0] || "."));
    if (!(await existsDir(workingDir))) {
      log.fatal("No such directory:", workingDir);
    }
    denoConfigFile = await findFile(workingDir, ["deno.jsonc", "deno.json", "tsconfig.json"]);
    importMapFile = await findFile(
      workingDir,
      ["import_map", "import-map", "importmap", "importMap"].map((name) => `${name}.json`),
    );
    if (importMapFile) {
      try {
        let update: boolean | null = null;
        const importMap = await readImportMap(importMapFile);
        for (const key in importMap.imports) {
          const url = importMap.imports[key];
          if (
            /\/\/deno\.land\/x\/aleph@v?\d+\.\d+\.\d+(-[a-z0-9\.]+)?\//.test(url)
          ) {
            const [prefix, rest] = util.splitBy(url, "@");
            const [ver, suffix] = util.splitBy(rest, "/");
            if (command === "dev" && ver !== "v" + VERSION && update === null) {
              update = confirm(
                `You are using a different version of Aleph.js, expect ${ver} -> v${bold(VERSION)}, update '${
                  basename(importMapFile)
                }'?`,
              );
              if (!update) {
                cliVerison = ver.slice(1);
                break;
              }
            }
            if (update) {
              importMap.imports[key] = `${prefix}@v${VERSION}/${suffix}`;
            }
          }
        }
        if (update) {
          await Deno.writeTextFile(
            importMapFile,
            JSON.stringify(importMap, undefined, 2),
          );
        }
      } catch (e) {
        log.error(`invalid '${basename(importMapFile)}':`, e.message);
        if (!confirm("Continue?")) {
          Deno.exit(1);
        }
      }
    }
  }
  await runCli(command, cliVerison, denoConfigFile, importMapFile);
}

async function runCli(command: string, version: string, denoConfigFile?: string, importMapFile?: string) {
  const cmd: string[] = [
    Deno.execPath(),
    "run",
    "-A",
    "--unstable",
    "--no-check=remote",
    "--location=http://localhost",
  ];
  if (denoConfigFile) {
    cmd.push("--config", denoConfigFile);
  }
  if (importMapFile) {
    cmd.push("--import-map", importMapFile);
  }
  if (Deno.env.get("ALEPH_DEV")) {
    cmd.push(`./commands/${command}.ts`);
  } else {
    cmd.push(`https://deno.land/x/aleph@v${version}/commands/${command}.ts`);
  }
  cmd.push(...Deno.args.slice(1));
  const p = Deno.run({ cmd, stdout: "inherit", stderr: "inherit" });
  const { code } = await p.status();
  Deno.exit(code);
}

if (import.meta.main) {
  main();
}
