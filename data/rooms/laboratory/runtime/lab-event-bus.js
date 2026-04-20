export function createLabEventBus() {
  const listeners = /* @__PURE__ */ new Set();
  const history = [];
  function emit(event) {
    history.push(event);
    if (history.length > 400) {
      history.shift();
    }
    listeners.forEach(function(listener) {
      listener(event);
    });
  }
  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }
  function getHistory() {
    return history.slice();
  }
  return {
    emit,
    getHistory,
    subscribe
  };
}
