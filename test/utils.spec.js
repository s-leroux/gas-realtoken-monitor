// test/alphaVantage.test.mjs

import { assert } from "chai";
import { loadGasCode } from "./gas-loader.js";

// Load the actual GAS code
const gasContext = loadGasCode("Code.js");

// Extract the functions we want to test
const { toDateOnly } = gasContext;

describe("Core utilities", function () {
  describe("to_date_only()", function () {
    it("should return a date object with time component removed", function () {
      const date = new Date("2025-08-01T10:25:39.000Z");
      const result = toDateOnly(date);
      assert.equal(result.getFullYear(), 2025);
      assert.equal(result.getMonth(), 7);
      assert.equal(result.getDate(), 1);
      assert.equal(result.getHours(), 0);
      assert.equal(result.getMinutes(), 0);
      assert.equal(result.getSeconds(), 0);
    });
  });
});
