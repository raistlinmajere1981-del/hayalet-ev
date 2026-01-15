/**
 * Custom Event sabitleri
 */

export const EVENTS = {
  SLOT_CONNECTED: "slot:connected",
  SLOT_DISCONNECTED: "slot:disconnected",
  SLOT_ERROR: "slot:error",
  SLOT_URL_CHANGED: "slot:url-changed",
  
  WEBVIEW_DOM_READY: "webview:dom-ready",
  WEBVIEW_LOAD_START: "webview:load-start",
  WEBVIEW_LOAD_STOP: "webview:load-stop",
  
  TRAFFIC_LOADING: "traffic:loading",
  TRAFFIC_THINKING: "traffic:thinking",
  TRAFFIC_IDLE: "traffic:idle",
  
  MESSAGE_SENT: "message:sent",
  MESSAGE_RECEIVED: "message:received",
  
  SETTINGS_CHANGED: "settings:changed",
  
  RELAY_START: "relay:start",
  RELAY_STOP: "relay:stop",
  RELAY_MESSAGE: "relay:message",
};

export const DOM_EVENTS = {
  CLICK: "click",
  INPUT: "input",
  CHANGE: "change",
  KEYDOWN: "keydown",
  SUBMIT: "submit",
  SCROLL: "scroll",
  MOUSEDOWN: "mousedown",
  MOUSEUP: "mouseup",
};
