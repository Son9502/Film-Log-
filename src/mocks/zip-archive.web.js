// Stub for react-native-zip-archive on web — the real library uses native modules
// that don't exist in a browser environment. The import screen shows a
// "mobile only" message on web so this is never actually called.
export function unzip() {
  return Promise.reject(new Error("ZIP extraction is not supported on web."));
}
