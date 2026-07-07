import type {
  AppSettings,
  Bar,
  ConnectionStatus,
  DateRange,
  Metrics,
  WatchlistItem,
  AlertResult,
} from './types';

export const MESSAGE_TYPES = {
  BARS_UPDATE: 'BARS_UPDATE',
  SYMBOL_CHANGED: 'SYMBOL_CHANGED',
  CONNECTION_STATUS: 'CONNECTION_STATUS',
  GET_STATE: 'GET_STATE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  UPDATE_WATCHLIST: 'UPDATE_WATCHLIST',
  UPDATE_DATE_RANGE: 'UPDATE_DATE_RANGE',
  ADD_CURRENT_TO_WATCHLIST: 'ADD_CURRENT_TO_WATCHLIST',
  REMOVE_FROM_WATCHLIST: 'REMOVE_FROM_WATCHLIST',
  TOGGLE_MONITORING: 'TOGGLE_MONITORING',
  DISMISS_ALERT: 'DISMISS_ALERT',
  REQUEST_INJECT: 'REQUEST_INJECT',
  GET_TV_SESSION: 'GET_TV_SESSION',
  GET_PIPELINE_DIAGNOSTIC: 'GET_PIPELINE_DIAGNOSTIC',
  STATE_SYNC: 'STATE_SYNC',
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export type BarsUpdateMessage = {
  type: typeof MESSAGE_TYPES.BARS_UPDATE;
  tabId: number;
  symbol: string;
  bars: Bar[];
  lastUpdatedAt: number;
};

export type SymbolChangedMessage = {
  type: typeof MESSAGE_TYPES.SYMBOL_CHANGED;
  tabId: number;
  symbol: string;
};

export type ConnectionStatusMessage = {
  type: typeof MESSAGE_TYPES.CONNECTION_STATUS;
  tabId: number;
  status: ConnectionStatus;
};

export type GetStateMessage = {
  type: typeof MESSAGE_TYPES.GET_STATE;
  tabId: number;
};

export type UpdateSettingsMessage = {
  type: typeof MESSAGE_TYPES.UPDATE_SETTINGS;
  tabId: number;
  settings: AppSettings;
};

export type UpdateWatchlistMessage = {
  type: typeof MESSAGE_TYPES.UPDATE_WATCHLIST;
  tabId: number;
  watchlist: WatchlistItem[];
};

export type UpdateDateRangeMessage = {
  type: typeof MESSAGE_TYPES.UPDATE_DATE_RANGE;
  tabId: number;
  dateRange: DateRange;
};

export type AddCurrentToWatchlistMessage = {
  type: typeof MESSAGE_TYPES.ADD_CURRENT_TO_WATCHLIST;
  tabId: number;
  symbol: string;
};

export type RemoveFromWatchlistMessage = {
  type: typeof MESSAGE_TYPES.REMOVE_FROM_WATCHLIST;
  tabId: number;
  symbol: string;
};

export type ToggleMonitoringMessage = {
  type: typeof MESSAGE_TYPES.TOGGLE_MONITORING;
  tabId: number;
  symbol: string;
};

export type DismissAlertMessage = {
  type: typeof MESSAGE_TYPES.DISMISS_ALERT;
  tabId: number;
};

export type RequestInjectMessage = {
  type: typeof MESSAGE_TYPES.REQUEST_INJECT;
};

export type GetTvSessionMessage = {
  type: typeof MESSAGE_TYPES.GET_TV_SESSION;
  pageUrl?: string;
};

export type TvSessionPayload = {
  sessionid: string;
  sessionid_sign?: string;
  loggedIn: boolean;
};

export type GetPipelineDiagnosticMessage = {
  type: typeof MESSAGE_TYPES.GET_PIPELINE_DIAGNOSTIC;
  pageUrl?: string;
};

export type PipelineDiagnosticState = StateSyncPayload & {
  symbolBarsLastUpdatedAt?: number;
  tabConnectionStatus?: ConnectionStatus;
};

export type StateSyncPayload = {
  symbol: string | null;
  bars: Bar[];
  metrics: Metrics | null;
  fullMetrics: Metrics | null;
  settings: AppSettings;
  watchlist: WatchlistItem[];
  dateRange: DateRange;
  connectionStatus: ConnectionStatus;
  alert: AlertResult | null;
  alertDismissed: boolean;
};

export type StateSyncMessage = {
  type: typeof MESSAGE_TYPES.STATE_SYNC;
  tabId: number;
  payload: StateSyncPayload;
};

export type ExtensionMessage =
  | BarsUpdateMessage
  | SymbolChangedMessage
  | ConnectionStatusMessage
  | GetStateMessage
  | UpdateSettingsMessage
  | UpdateWatchlistMessage
  | UpdateDateRangeMessage
  | AddCurrentToWatchlistMessage
  | RemoveFromWatchlistMessage
  | ToggleMonitoringMessage
  | DismissAlertMessage
  | RequestInjectMessage
  | GetTvSessionMessage
  | GetPipelineDiagnosticMessage
  | StateSyncMessage;

export const INJECT_MESSAGE_TYPE = 'TV_QUANTS_DATA';
export const INJECT_SYMBOL_MESSAGE_TYPE = 'TV_QUANTS_SYMBOL';
export const INJECT_BARS_SNAPSHOT_TYPE = 'TV_QUANTS_BARS_SNAPSHOT';
export const INJECT_SESSION_MESSAGE_TYPE = 'TV_QUANTS_SESSION';
