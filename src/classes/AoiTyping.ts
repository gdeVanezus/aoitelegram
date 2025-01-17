import type { AoiClient } from "./AoiClient";
import type { AoiManager } from "./AoiManager";
import type { Context, IEventFunctions } from "telegramsjs";
import type { ValueDatabase } from "../helpers/manager/TimeoutManager";
import type {
  Container,
  ParserFunction,
  ICallbackResolve,
  ICallbackReject,
} from "./core/";
import {
  Update,
  UserFromGetMe,
  Message,
  MessageReactionUpdated,
  MessageReactionCountUpdated,
  CallbackQuery,
  InlineQuery,
  ShippingQuery,
  PreCheckoutQuery,
  Poll,
  PollAnswer,
  ChatMemberUpdated,
  ChatJoinRequest,
  MessageEntity,
  ChatBoostUpdated,
  ChatBoostRemoved,
} from "@telegram.ts/types";

interface CaptionableMessage {
  caption: string;
  caption_entities?: MessageEntity[];
}

interface AwaitedEvent {
  awaited: string;
  milliseconds: number;
  data: string;
  code: string;
}

interface EventHandlers extends IEventFunctions {
  timeout: (client: AoiClient, database: ValueDatabase) => void;
  awaited: (event: AwaitedEvent, data: unknown) => void;
  functionError: (
    client: AoiClient,
    eventContext: Context & { telegram: AoiClient },
  ) => void;
  addTimeout: (eventContext: ValueDatabase) => void;
}

interface CustomAoiFunction {
  name: string;
  aliases?: string[];
  reverseReading?: boolean;
  type: "aoitelegram";
  version?: string;
  params?: string[];
  code: string;
}

interface CustomJSFunction {
  name: string;
  aliases?: string[];
  type?: "javascript";
  fields?: { required: boolean; rest?: boolean }[];
  brackets?: boolean;
  version?: string;
  callback: (
    context: Container,
    func: ParserFunction,
    code?: string,
  ) => PossiblyAsync<ICallbackResolve | ICallbackReject>;
}

type DataFunction = CustomAoiFunction | CustomJSFunction;

type ContextEvent = Context &
  UserFromGetMe &
  Message &
  MessageReactionUpdated &
  MessageReactionCountUpdated &
  CallbackQuery &
  InlineQuery &
  ShippingQuery &
  PreCheckoutQuery &
  Poll &
  PollAnswer &
  ChatMemberUpdated &
  ChatJoinRequest &
  ChatBoostUpdated &
  ChatBoostRemoved & { api: AoiClient };

type DataEvent = {
  listen: string;
  type: string;
  once?: boolean;
  code?: string;
  callback?: (...args: any[]) => void;
};

type PossiblyAsync<T> = T | Promise<T>;

export {
  EventHandlers,
  ContextEvent,
  CustomJSFunction,
  CustomAoiFunction,
  DataFunction,
  DataEvent,
  PossiblyAsync,
};
