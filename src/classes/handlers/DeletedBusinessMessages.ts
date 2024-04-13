import type { AoiClient } from "../AoiClient";

function onDeletedBusinessMessages(telegram: AoiClient) {
  const events = telegram.events.get("deletedBusinessMessages");
  if (!events) return;

  for (const event of events) {
    telegram.on("deleted_business_messages", async (ctx) => {
      await telegram.evaluateCommand(event, ctx);
    });
  }
}

export default onDeletedBusinessMessages;
