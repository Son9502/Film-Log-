// Stub for react-native-share on web — sharing features are native only (Phase 5)
export default {
  open: () => Promise.reject(new Error("Sharing is not supported on web.")),
  shareSingle: () => Promise.reject(new Error("Sharing is not supported on web.")),
};
export const Social = {};
