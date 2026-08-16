module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["dotenv/config"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testTimeout: 20000,
};
