module.exports = {
  default: {
    paths: ["tests/bdd/**/*.feature"],
    requireModule: ["tsx/cjs"],
    require: ["tests/bdd/steps/**/*.ts"],
    format: [
      "progress",
      "json:.artifacts/reports/cucumber/cucumber-report.json",
      "junit:.artifacts/reports/cucumber/cucumber-junit.xml"
    ]
  }
};
