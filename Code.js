const REALT_PRODUCTS_ENDPOINT =
  "https://realt.co/wp-json/realt/v1/products/for_sale";

const USER_EMAIL =
  PropertiesService.getScriptProperties().getProperty("USER_EMAIL");

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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

function loadSheet(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  // 1. Get the header row (row 1, starting in A1)
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // 2. Load the table in memory
  const columns = Object.create(null);
  const ranges = Object.create(null);

  headers.forEach((header, idx) => {
    const range = (ranges[header] = sheet.getRange(
      2,
      idx + 1,
      sheet.getLastRow() - 1
    ));
    columns[header] = range.getValues().flat();
  });

  return [headers, ranges, columns];
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
  const [headers, ranges, columns] = loadSheet("Monitor");
  const productsForSale = loadProductsForSale();
  const dataTime = new Date(productsForSale.time * 1000);

  const message = new Message();

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
  for (const header of ["Status", "Stock", "Max Purchase", "Checked", "Sent"]) {
    ranges[header].setValues(columns[header].map((x) => [x]));
  }
}
