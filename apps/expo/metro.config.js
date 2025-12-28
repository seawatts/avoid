// Learn more https://docs.expo.io/guides/customizing-metro
/** biome-ignore-all lint/style/noCommonJs: metro.config.js is a CommonJS file */
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
