//----------------------------------------------------------------------------
//  GAS LOADER FOR GOOGLE SHEETS
//  v1.1
//----------------------------------------------------------------------------
import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

import { PRODUCTS_FOR_SALE } from "./fixtures.js";
import { setHeapSnapshotNearHeapLimit } from "v8";

//----------------------------------------------------------------------------
//  URL INTERFACE
//----------------------------------------------------------------------------
const UrlFetchApp = {
  fetch(urlString) {
    const responsePayload = PRODUCTS_FOR_SALE;

    return {
      getContentText() {
        return JSON.stringify(responsePayload);
      },
    };
  },
};

//----------------------------------------------------------------------------
//  SPREADSHEET INTERFACE
//----------------------------------------------------------------------------
const Spreadsheet = class {
  getSheetByName(name) {
    return new Sheet({ name });
  }
};

class Sheet {
  constructor(metadata, rows) {
    this.metadata = metadata;
    this.rows = rows || [
      ["A1", "B1", "C1"],
      ["A2", "B2", "C2"],
      ["A3", "B3", "C3"],
      ["A4", "B4", "C4"],
      ["A5", "B5", "C5"],
      ["A6", "B6", "C6"],
    ];
  }

  getRange(...args) {
    return new Range(this, ...args);
  }

  getLastColumn() {
    return this.rows.reduce(
      (acc, row) => (row.length > acc ? row.length : acc),
      0
    );
  }

  getLastRow() {
    return this.rows.length;
  }
}

class Range {
  constructor(sheet, rowIndex, columnIndex, numRows = 1, numColumns = 1) {
    this.sheet = sheet;
    this.rowIndex = rowIndex;
    this.columnIndex = columnIndex;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  getValues() {
    const dstRows = [];
    for (let rowOffset = 0; rowOffset < this.numRows; ++rowOffset) {
      const srcRow = this.sheet.rows[this.rowIndex + rowOffset - 1];

      const dstColumn = [];
      dstRows.push(dstColumn);

      for (
        let columnOffset = 0;
        columnOffset < this.numColumns;
        ++columnOffset
      ) {
        dstColumn.push(srcRow[this.columnIndex + columnOffset - 1]);
      }
    }

    return dstRows;
  }

  setValues() {}

  getLastColumn() {
    return this.columnIndex + this.numColumns - 1;
  }

  getLastRow() {
    return this.rowIndex + this.numRows - 1;
  }
}

const SpreadsheetApp = {
  getActiveSpreadsheet() {
    return new Spreadsheet();
  },

  openById() {
    return new Spreadsheet();
  },
};

// Needed for __dirname / __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock Google Apps Script APIs
const gasGlobals = (function () {
  return {
    UrlFetchApp,
    SpreadsheetApp,
    Spreadsheet,
    Sheet,
    Range,
    Logger: {
      log: console.log,
    },
    MailApp: {
      sendEmail: () => {},
      getRemainingDailyQuota: () => 100,
    },

    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => process.env[key],
      }),
    },
  };
})();

export function loadGasCode(fileName) {
  // Read the GAS code file
  const codeContent = fs.readFileSync(
    path.join(__dirname, "..", fileName),
    "utf8"
  );

  // Create a context with GAS globals
  const context = {
    ...gasGlobals,
    console,
    Buffer,
    process,
    global,
    // require, // if you still use require inside the loaded GAS file
    __dirname,
    __filename,
  };

  // Create a VM context
  const vmContext = vm.createContext(context);

  // Execute the GAS code in the VM context
  vm.runInContext(codeContent, vmContext);

  // Return the context with all the functions now available
  return context;
}
