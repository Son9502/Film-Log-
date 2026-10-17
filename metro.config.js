const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const WEB_STUBS = {
  "react-native-zip-archive": "src/mocks/zip-archive.web.js",
  "react-native-maps":        "src/mocks/react-native-maps.web.js",
  "react-native-share":       "src/mocks/react-native-share.web.js",
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_STUBS[moduleName]) {
    return {
      filePath: path.resolve(__dirname, WEB_STUBS[moduleName]),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
