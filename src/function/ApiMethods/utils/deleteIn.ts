import { DataFunction } from "context";

const data: DataFunction = {
  name: "$deleteIn",
  callback: async (ctx, event, database, error) => {
    if (!ctx.argsCheck(1, true, error, "$deleteIn")) return;
    const args = await ctx.evaluateArgs(ctx.getArgs());
    const chatId = event.chat.id ?? event.message?.chat.id;
    const messageId = event.message_id ?? event.message?.message_id;
    setTimeout(() => {
      event.deleteMessage(args[1] ?? messageId).catch(() => console.log());
    }, args[0] * 1000);
    return "";
  },
};

export { data };