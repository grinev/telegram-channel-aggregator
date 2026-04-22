declare module 'telegram/events' {
  export { NewMessage, NewMessageEvent } from 'telegram/events/NewMessage';
  export { EditedMessage, EditedMessageEvent } from 'telegram/events/EditedMessage';
  export { DeletedMessage, DeletedMessageEvent } from 'telegram/events/DeletedMessage';
  export { CallbackQuery, CallbackQueryEvent } from 'telegram/events/CallbackQuery';
  export { Album, AlbumEvent } from 'telegram/events/Album';
  export { Raw } from 'telegram/events/Raw';
}

declare module 'telegram/sessions' {
  export { StringSession } from 'telegram/sessions/StringSession';
  export { MemorySession } from 'telegram/sessions/Memory';
  export { StoreSession } from 'telegram/sessions/StoreSession';
  export { Session } from 'telegram/sessions/Abstract';
}
