const REALT_PRODUCTS_ENDPOINT =
  "https://realt.co/wp-json/realt/v1/products/for_sale";

const properties = PropertiesService.getScriptProperties();
const USER_EMAIL = properties.getProperty("USER_EMAIL");
const SPREADSHEET_ID = properties.getProperty("SPREADSHEET_ID");

const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
const sheet = spreadsheet.getSheetByName("MONITOR");

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

//----------------------------------------------------------------------------
//  BEGIN COMMON MESSAGE INTERFACE
//  v1.0
//----------------------------------------------------------------------------

// Declared as `var` to make it accessible in the global context for testing purposes
var Message = class Message {
  /**
   * Creates a new Message instance.
   */
  constructor() {
    this.critical = false;
    /** @type {string[]} */
    this.lines = [];
  }

  /**
   * Adds one or more lines to the message.
   * @param {boolean} critical - true for critical message.
   * @param {...string} lines - One or more lines to append.
   * @returns {Message} This instance for chaining.
   */
  push(critical, ...lines) {
    if (critical) this.critical = true;

    this.lines.push(...lines);
    return this;
  }

  /**
   * Returns the full message text, with lines joined by newline characters.
   * @returns {string} The concatenated message text.
   */
  text() {
    return this.lines.join("\n");
  }
};

//----------------------------------------------------------------------------
//  END COMMON MESSAGE INTERFACE
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//  BEGIN COMMON TABLE INTERFACE
//  v1.0
//----------------------------------------------------------------------------
var Table = class Table {
  /**
   * Creates a new Table instance.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The Google Sheets sheet to operate on.
   */
  constructor(sheet) {
    // 1. Get the header row (row 1, starting in A1)
    const headers = (this.headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]);

    // 2. Load the table in memory
    const columns = (this.columns = Object.create(null));
    const ranges = (this.ranges = Object.create(null));

    headers.forEach((header, idx) => {
      const range = (ranges[header] = sheet.getRange(
        2,
        idx + 1,
        sheet.getLastRow() - 1
      ));
      columns[header] = range.getValues().flat();
    });
  }

  update(...headers) {
    for (const header of headers) {
      this.ranges[header].setValues(this.columns[header].map((x) => [x]));
    }
  }

  updateAll() {
    this.update(...this.header);
  }
};
//----------------------------------------------------------------------------
//  END COMMON TABLE INTERFACE
//----------------------------------------------------------------------------

function loadProductsForSale() {
  const response = UrlFetchApp.fetch(REALT_PRODUCTS_ENDPOINT);
  const json = JSON.parse(response.getContentText()) || {};

  return json;
}

function findProduct(productsForSale, productName) {
  return productsForSale.products.find(
    (product) => product.title === productName
  );
}

/**
 *
 * @param {Message} message
 * @param {boolean} critical
 * @param {string} title
 */
function pushMessageProductNotFound(message, critical, title) {
  message.push(critical, `NOT FOUND: ${title}`);
}

/**
 *
 * @param {Message} message
 * @param {boolean} critical
 * @param {object} product
 */
function pushMessageLowStock(message, critical, product) {
  message.push(critical, `LOW STOCK: ${product.title} × ${product.stock}`);
}

function update() {
  const today = toDateOnly(new Date());
  const table = new Table(sheet);
  const productsForSale = loadProductsForSale();
  const dataTime = new Date(productsForSale.time * 1000);

  const message = new Message();

  const columns = table.columns;
  for (let i = 0; i < columns["Name"].length; ++i) {
    const product = findProduct(productsForSale, columns["Name"][i]);
    columns["Checked"][i] = dataTime;
    if (!product) {
      pushMessageProductNotFound(
        message,
        today > columns["Sent"][i],
        columns["Name"][i]
      );
      columns["Status"][i] = "NOT FOUND";
      columns["Stock"][i] = 0;
      columns["Max Purchase"][i] = 0;
      columns["Sent"][i] = today;
    } else {
      columns["Stock"][i] = product.stock;
      columns["Max Purchase"][i] = product.max_purchase;

      if (product.stock < 1.1 * product.max_purchase) {
        pushMessageLowStock(message, today > columns["Sent"][i], product);
        columns["Status"][i] = "LOW STOCK";
        columns["Sent"][i] = today;
      } else {
        columns["Status"][i] = product.status.toUpperCase();
      }
    }
  }

  if (message.critical) {
    MailApp.sendEmail({
      to: USER_EMAIL,
      subject: `⚠️ Realt Alert`,
      body: message.text(),
    });
  }

  // Update columns
  table.update("Status", "Stock", "Max Purchase", "Checked", "Sent");
}
