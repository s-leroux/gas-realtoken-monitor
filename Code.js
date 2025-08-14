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
//  v1.1
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
   * @param {...string} fragments - One or more lines to append.
   * @returns {Message} This instance for chaining.
   */
  push(critical, ...fragments) {
    if (critical) this.critical = true;

    for (const fragment of fragments) {
      const lines = fragment
        .split(/\r?\n/)
        .map((line) => (critical ? "| " : "  ") + line);
      this.lines.push(...lines);
    }
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
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

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

    this.headers = headers;
    this.columns = columns;
    this.ranges = ranges;
  }

  getNumRows() {
    return this.headers.length > 0 ? this.columns[this.headers[0]].length : 0;
  }
  getNumColumns() {
    return this.headers.length;
  }

  getRow(idx) {
    const obj = Object.create(null);

    for (const header of this.headers) {
      obj[header] = this.columns[header][idx];
    }

    return obj;
  }

  append(obj) {
    for (const header of this.headers) {
      const column = this.columns[header].push(obj[header]);
      this.ranges[header] = this.ranges[header].offset(
        0,
        0,
        this.columns[header].length
      );
    }
  }

  update(idx, obj) {
    for (const header of this.headers) {
      this.columns[header][idx] = obj[header];
    }
  }

  write(...headers) {
    for (const header of headers) {
      this.ranges[header].setValues(this.columns[header].map((x) => [x]));
    }
  }

  writeAll() {
    this.write(...this.headers);
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
 * Removes and returns the product whose `title` matches `productName`.
 *
 * @param {Object} productsForSale – An object with a `products` array.
 * @param {string} productName     – The product title to search for.
 * @returns {Object|undefined}     – The popped product, or undefined if none found.
 */
function popProduct(productsForSale, productName) {
  const idx = productsForSale.products.findIndex(
    (product) => product.title === productName
  );

  if (idx === -1) return undefined; // not found

  // splice returns an array of removed items; take the first one
  return productsForSale.products.splice(idx, 1)[0];
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
function pushMessageUntracked(message, critical, product) {
  message.push(critical, `UNTRACKED: ${product.title} × ${product.stock}`);
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

/**
 *
 * @param {Message} message
 * @param {boolean} critical
 * @param {object} product
 */
function pushMessageSold(message, critical, product, qty) {
  message.push(
    critical,
    `SELLING: ${product.title} Sold: ${qty} ; Remaining ${product.stock}`
  );
}

function update() {
  const today = toDateOnly(new Date());
  const table = new Table(sheet);
  const productsForSale = loadProductsForSale();
  const dataTime = new Date(productsForSale.time * 1000);

  const message = new Message();

  for (let i = 0; i < table.getNumRows(); ++i) {
    const row = table.getRow(i);
    const product = popProduct(productsForSale, row["Name"]);
    row["Checked"] = dataTime;
    if (!product) {
      pushMessageProductNotFound(message, today > row["Sent"], row["Name"]);
      row["Status"] = "NOT FOUND";
      row["Stock"] = 0;
      row["Max Purchase"] = 0;
      row["Sent"] = today;
    } else {
      if (product.stock < 1.1 * product.max_purchase) {
        pushMessageLowStock(
          message,
          today > row["Sent"] && row["Status"] !== "LOW STOCK",
          product
        );
        row["Status"] = "LOW STOCK";
        row["Sent"] = today;
      } else if (product.stock < row["Stock"]) {
        pushMessageSold(
          message,
          today > row["Sent"] && row["Status"] !== "SELLING",
          product,
          row["Stock"] - product.stock
        );

        row["Status"] = "SELLING";
        row["Sent"] = today;
      } else {
        row["Status"] = product.status.toUpperCase();
      }

      row["Stock"] = product.stock;
      row["Max Purchase"] = product.max_purchase;
    }

    table.update(i, row);
  }

  for (const product of productsForSale.products) {
    // These products are currently not tracked
    row = Object.create(null);
    row["Name"] = product.title;
    row["Ignore"] = false;
    row["Checked"] = today;
    row["Sent"] = today;
    row["Status"] = product.status.toUpperCase();
    row["Stock"] = product.stock;
    row["Max Purchase"] = product.max_purchase;

    pushMessageUntracked(message, true, product);

    table.append(row);
  }

  if (message.critical) {
    MailApp.sendEmail({
      to: USER_EMAIL,
      subject: `⚠️ Realt Alert`,
      body: message.text(),
    });
  }

  // Update columns
  table.writeAll();
}
