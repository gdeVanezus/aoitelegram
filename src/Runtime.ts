import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { DataFunction } from "context";
import { Context } from "./Context";
import { Environment } from "./Environment";
import { Evaluator } from "./Evaluator";
import { Lexer, TokenArgument, TokenOperator } from "./Lexer";
import { Parser } from "./Parser";
import { AoijsError, AoiStopping, MessageError } from "./classes/AoiError";
import { AoiManager } from "./classes/AoiManager";
import { TelegramBot, type Context as EventContext } from "telegramsjs";
import { UserFromGetMe } from "@telegram.ts/types";

interface RuntimeOptions {
  alwaysStrict: boolean;
  trimOutput: boolean;
}

/**
 * Represents the runtime environment for executing scripts.
 */
class Runtime {
  globalEnvironment = new Environment();
  private contexts = new Map<string, Context>();
  private evaluator = Evaluator.singleton;
  options: RuntimeOptions = {
    alwaysStrict: false,
    trimOutput: true,
  };
  database: AoiManager;
  plugin?: DataFunction[];

  /**
   * Constructs a new Runtime instance with a Telegram context.
   * @param telegram - The Telegram context for the runtime.
   * @param database - The local database.
   * @param plugin - An array of plugin functions.
   */
  constructor(
    telegram: EventContext["telegram"],
    database: AoiManager,
    plugin?: DataFunction[],
  ) {
    this.database = database;
    this.plugin = plugin;
    this.prepareGlobal(telegram, database, plugin);
  }

  /**
   * Runs the input script and returns the result.
   * @param fileName - The name of the script file.
   * @param input - The script code to execute.
   */
  runInput(fileName: string | { event: string }, input: string) {
    const abstractSyntaxTree = new Parser().parseToAst(
      new Lexer(input).main(),
      this,
    );
    const context = this.prepareContext(fileName);
    return this.evaluator.evaluate(abstractSyntaxTree, context);
  }

  /**
   * Prepares a new execution context for a script.
   * @param fileName - The name of the script file.
   */
  prepareContext(fileName: string | { event: string }) {
    const environment = new Environment(this.globalEnvironment);
    const eventType = typeof fileName === "string" ? "command" : "event";
    const executionContext = new Context(
      fileName,
      environment,
      this,
      eventType,
    );
    const scriptName =
      typeof fileName === "string" ? fileName : fileName?.event;
    this.contexts.set(scriptName, executionContext);
    return executionContext;
  }

  /**
   * Retrieves the execution context for a specific script.
   * @param fileName - The name of the script file.
   */
  getContext(fileName: string | { event: string }) {
    const scriptName =
      typeof fileName === "string" ? fileName : fileName?.event;
    return this.contexts.get(scriptName);
  }

  /**
   * Prepares the global environment for custom functions by reading functions in a directory and from custom plugins.
   * @param telegram - The Telegram context.
   * @param database - The local database.
   * @param plugin - An array of custom function definitions.
   */
  private prepareGlobal(
    telegram: EventContext["telegram"],
    database: AoiManager,
    plugin?: DataFunction[],
  ) {
    readFunctionsInDirectory(
      __dirname.replace("classes", "function"),
      this.globalEnvironment,
      telegram,
      database,
    );
    if (Array.isArray(plugin)) {
      readFunctions(plugin, this.globalEnvironment, telegram, database, this);
    }
  }
}

/**
 * Runs Aoi code using a Runtime instance.
 * @param command - The command or event data for the code execution.
 * @param code - The Aoi code to execute.
 * @param telegram - The Telegram context.
 * @param runtime - The Runtime instance.
 */
async function runAoiCode(
  command: string | { event: string },
  code: string,
  telegram: (TelegramBot & EventContext) | UserFromGetMe,
  runtime: Runtime,
) {
  try {
    const aoiRuntime = new Runtime(telegram, runtime.database, runtime?.plugin);
    await aoiRuntime.runInput(command, code);
  } catch (error) {
    if (!(error instanceof AoiStopping)) throw error;
  }
}

/**
 * Reads and initializes custom functions and adds them to the parent global environment.
 * @param plugin - An array of custom function definitions.
 * @param parent - The global environment where functions will be added.
 * @param telegram - The Telegram context.
 * @param database - The local database.
 * @param runtime - The Runtime instance.
 */
function readFunctions(
  plugin: DataFunction[],
  parent: Runtime["globalEnvironment"],
  telegram: EventContext["telegram"],
  database: AoiManager,
  runtime: Runtime,
) {
  for (const dataFunction of plugin) {
    if (
      dataFunction.name &&
      (dataFunction.type === "js" || !dataFunction.type)
    ) {
      parent.set(dataFunction.name, async (context) => {
        const error = new MessageError(telegram);
        if (!dataFunction.callback) {
          throw new AoijsError(
            "runtime",
            "You specified the type as 'js', so to describe the actions of this function, the 'callback' parameter is required.",
          );
        }
        const response = await dataFunction.callback(
          context,
          telegram,
          database,
          error,
        );
        return response;
      });
    } else if (dataFunction.name && dataFunction.type === "aoitelegram") {
      parent.set(dataFunction.name, async (context) => {
        if (!dataFunction.code) {
          throw new AoijsError(
            "runtime",
            "You specified the type as 'aoitelegram', so to describe the actions of this function, the 'code' parameter is required.",
          );
        }
        const response = await runAoiCode(
          context.fileName,
          dataFunction.code,
          telegram,
          runtime,
        );
        return response;
      });
    } else {
      throw new AoijsError(
        "runtime",
        "The specified parameters for creating a custom function do not match the requirements.",
      );
    }
  }
}

/**
 * Recursively reads and initializes functions in a directory and adds them to the parent global environment.
 * @param dirPath - The directory path to search for functions.
 * @param parent - The global environment where functions will be added.
 * @param telegram - The Telegram context.
 * @param database - The local database.
 */
function readFunctionsInDirectory(
  dirPath: string,
  parent: Runtime["globalEnvironment"],
  telegram: EventContext["telegram"],
  database: AoiManager,
) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      readFunctionsInDirectory(itemPath, parent, telegram, database);
    } else if (itemPath.endsWith(".js")) {
      const dataFunction = require(itemPath).data;
      if (dataFunction) {
        parent.set(dataFunction.name, async (context) => {
          const error = new MessageError(telegram);
          const response = await dataFunction.callback(
            context,
            telegram,
            database,
            error,
          );
          if (dataFunction.name === "$onlyIf" && response?.stop === true) {
            throw new AoiStopping("$onlyIf");
          }
          return response;
        });
      }
    }
  }
}

export { Runtime, RuntimeOptions };
