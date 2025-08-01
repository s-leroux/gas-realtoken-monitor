// test/alphaVantage.test.mjs

import { assert } from "chai";
import { loadGasCode } from "./gas-loader.js";

import { PRODUCTS_FOR_SALE } from "./fixtures.js";

// Load the actual GAS code
const gasContext = loadGasCode("Code.js");

// Extract the functions we want to test
const { toDateOnly, loadProductsForSale, findProduct } = gasContext;

describe("Core utilities", function () {
  describe("toDateOnly()", function () {
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

  describe("loadProductsForSale()", function () {
    it("should identify a product in the list", function () {
      const target = PRODUCTS_FOR_SALE.products[3];

      const productsForSale = loadProductsForSale();
      const product = findProduct(productsForSale, target.title);

      assert.deepEqual(product, target);
    });

    it("should return undefined if the product is not found", function () {
      const productsForSale = loadProductsForSale();
      const product = findProduct(productsForSale, "Nowhere");

      assert.deepEqual(product, undefined);
    });
  });
});
