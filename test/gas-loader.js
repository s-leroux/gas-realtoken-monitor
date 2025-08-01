import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

import { PRODUCTS_FOR_SALE } from "./fixtures.js";

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

// Needed for __dirname / __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock Google Apps Script APIs
const gasGlobals = {
  UrlFetchApp,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: () => ({
        getRange: () => ({
          getValues: () => [[]],
          setValues: () => {},
          getLastColumn: () => 1,
          getLastRow: () => 1,
        }),
      }),
    }),
  },
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
