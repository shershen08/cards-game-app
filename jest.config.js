module.exports = {
    transform: {
      "^.+\\.js$": "babel-jest",
      "^.+\\.svelte$": "svelte-jest"
    },
    moduleFileExtensions: ["js", "json", "svelte"],
    coverageReporters: ["html"],
    bail: false,
    verbose: false,
    setupFilesAfterEnv: ["@testing-library/jest-dom/extend-expect"]
  };