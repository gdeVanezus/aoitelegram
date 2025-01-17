import { getObjectKey } from "../utils/";
import { AoijsTypeError } from "../classes/AoiError";
import { Collection } from "@telegram.ts/collection";
import type { AoiClient } from "../classes/AoiClient";
import { setInterval, clearInterval } from "long-timeout";

interface AwaitedDescription {
  awaited: string;
  code: string;
  [key: string]: unknown;
}

class Awaited {
  public readonly awaiteds: Collection<string, AwaitedDescription> =
    new Collection();

  telegram: AoiClient;

  constructor(telegram: AoiClient) {
    this.telegram = telegram;
  }

  register(awaited: AwaitedDescription): Awaited {
    const existingIndex = this.awaiteds.has(awaited.awaited);

    if (!existingIndex) {
      this.awaiteds.set(awaited.awaited, awaited);
    } else {
      throw new AoijsTypeError(
        `The awaited '${awaited.awaited}' already exists`,
      );
    }

    return this;
  }

  handler(): void {
    this.telegram.on("awaited", async (awaited, context) => {
      for (const [awaitedId, awaitedDescription] of this.awaiteds) {
        if (awaitedId !== awaited.awaited) continue;

        let currentIndex = 1;
        const intervalId = setInterval(async () => {
          const parsedAwaitedData = JSON.parse(JSON.stringify(awaited.data));
          this.telegram.ensureCustomFunction([
            {
              name: "$awaitedData",
              brackets: true,
              fields: [
                {
                  required: false,
                },
              ],
              callback: async (context, func) => {
                const response = getObjectKey(
                  parsedAwaitedData,
                  await func.resolveAllFields(context),
                );
                return func.resolve(response);
              },
            },
            {
              name: "$break",
              brackets: false,
              callback: (context, func) => {
                clearInterval(intervalId);
                return func.resolve();
              },
            },
            {
              name: "$continue",
              brackets: false,
              callback: (context, func) => func.reject(),
            },
            {
              name: "$index",
              brackets: false,
              callback: (context, func) => func.resolve(currentIndex),
            },
          ]);

          await this.telegram.evaluateCommand(awaitedDescription, context);
          currentIndex++;
        }, awaited.milliseconds);
      }
    });
  }
}

export { Awaited, AwaitedDescription };
