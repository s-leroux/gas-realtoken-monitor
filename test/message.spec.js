// test/alphaVantage.test.mjs

import { assert } from "chai";
import { loadGasCode } from "./gas-loader.js";

import { PRODUCTS_FOR_SALE } from "./fixtures.js";

// Load the actual GAS code
const gasContext = loadGasCode("Code.js");

// Extract the functions we want to test
const { Message } = gasContext;

describe("Message Building Subsystem", function () {
  describe("Message", function () {
    describe("new Message()", function () {
      it("should create a new Message instance", function () {
        new Message();
      });

      it("should gather messages", function () {
        const lines = ["abc", "dev", "ghi"];

        const message = new Message();
        for (const line of lines) {
          message.push(false, line);
        }

        assert.strictEqual(
          message.text(),
          lines.map((line) => `  ${line}`).join("\n")
        );
        assert.strictEqual(message.critical, false);
      });

      it("should remember critical messages", function () {
        const output = ["  abc", "| dev", "  ghi"];
        const input = output.map((line) => line.substring(2));

        const message = new Message();
        message.push(false, input[0]);
        message.push(true, input[1]);
        message.push(false, input[2]);

        assert.strictEqual(message.text(), output.join("\n"));
        assert.strictEqual(message.critical, true);
      });
    });
  });
});
