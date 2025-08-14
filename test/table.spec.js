import { assert } from "chai";
import { loadGasCode } from "./gas-loader.js";

// Load the actual GAS code
const gasContext = loadGasCode("Code.js");

// Extract the functions we want to test
const { Table, Sheet, Range } = gasContext;

describe("Mock", function () {
  describe("Sheet and Range", function () {
    let sheet;

    beforeEach(function () {
      sheet = new Sheet();
    });

    describe("Sheet.getRange()", function () {
      it("should return a Range instance", function () {
        const range = sheet.getRange(1, 2);

        assert.instanceOf(range, Range);
      });
    });

    describe("Range.getValues()", function () {
      it("should return a Range instance", function () {
        const range = sheet.getRange(1, 2, 2, 1);
        const values = range.getValues();

        assert.deepEqual(values, [["B1"], ["B2"]]);
      });
    });

    describe("Sheet.getLastColumn()", function () {
      it("should return the 1-based index of the last column", function () {
        const result = sheet.getLastColumn();

        assert.equal(result, 3);
      });
    });
  });
});

const TABLE_DATA = [
  ["name", "age"],
  ["Alice", 25],
  ["Bob", 48],
  ["Claude", 57],
];

describe("The Table Interface", function () {
  describe("Table", function () {
    let sheet;
    beforeEach(function () {
      sheet = new Sheet({}, TABLE_DATA);
    });

    describe("new Table()", function () {
      it("should return a Table instance", function () {
        const table = new Table(sheet);

        assert.instanceOf(table, Table);
      });
    });

    describe("getNumRows()", function () {
      it("should return the number of rows in the table", function () {
        const table = new Table(sheet);

        assert.deepEqual(table.getNumRows(), 3);
      });
    });

    describe("getNumColumns()", function () {
      it("should return the number of columns in the table", function () {
        const table = new Table(sheet);

        assert.deepEqual(table.getNumColumns(), 2);
      });
    });

    describe("getRow()", function () {
      it("should return an object by row index (0-based)", function () {
        const table = new Table(sheet);

        assert.deepEqual(table.getRow(0), { name: "Alice", age: 25 });
      });
    });
  });
});
