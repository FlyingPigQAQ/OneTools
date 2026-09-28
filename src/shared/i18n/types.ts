import { en } from './en';

type LeafPaths<T, P extends string = ''> = T extends string
  ? P
  : {
      [K in keyof T & string]: LeafPaths<T[K], P extends '' ? K : `${P}.${K}`>;
    }[keyof T & string];

type DeepString<T> = T extends string ? string : { [K in keyof T]: DeepString<T[K]> };

export type Messages = DeepString<typeof en>;
export type MessageKey = LeafPaths<typeof en>;
export type Locale = 'zh' | 'en';

export interface AppError {
  key: MessageKey;
  params?: Record<string, string | number>;
  detail?: string;
}
