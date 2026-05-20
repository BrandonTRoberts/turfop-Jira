const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const propertiesPath = path.join(projectRoot, "android", "keystore.properties");

function fail(message) {
  console.error(`Android release signing check failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(propertiesPath)) {
  fail("android/keystore.properties is missing. Create it from android/keystore.properties.example before building a Play Store release.");
}

const raw = fs.readFileSync(propertiesPath, "utf8");
const properties = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return index === -1 ? [line, ""] : [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

for (const key of ["storeFile", "storePassword", "keyAlias", "keyPassword"]) {
  if (!properties[key] || properties[key] === "change-me") {
    fail(`android/keystore.properties has an invalid ${key}.`);
  }
}

const storeFile = path.resolve(path.dirname(propertiesPath), properties.storeFile);
if (!fs.existsSync(storeFile)) {
  fail(`keystore file does not exist: ${storeFile}`);
}

console.log("Android release signing config found.");
