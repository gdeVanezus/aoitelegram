import { FunctionManager } from "../../classes/FunctionManager";

export default new FunctionManager()
  .setName("$print")
  .setBrackets(true)
  .setFields({
    name: "text",
    required: true,
  })
  .onCallback(async (ctx, func) => {
    const text = await func.resolveArray(ctx);
    console.log(...text);
    return func.resolve("");
  });
