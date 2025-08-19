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

function G(cache, ticker, symbol) {
  return cache[ticker][symbol];
}

const SYMBOL_TABLE = {
  __proto__: null,

  STOCK: G,
  PREV_STOCK: G,
  MAX_PURCHASE: G,
  STATUS: G,
};

//----------------------------------------------------------------------------
//  BEGIN COMMON EVALUATION INTERFACE
//  v1.1
//----------------------------------------------------------------------------

/**
 * Retrieves cached data for a ticker and field, using a factory method to populate missing data.
 *
 * This function implements a lazy-loading cache pattern. It first checks if the required field
 * for the given ticker exists in the global cache. If the field is missing, it calls the factory
 * method to populate the cache with data for that ticker, then returns the requested field.
 *
 * @param {string} ticker - The stock ticker symbol (e.g., "AAPL", "GOOGL"). Will be converted to uppercase.
 * @param {string} field - The specific field to retrieve from the cached data (e.g., "PRICE", "VOLUME")
 * @param {Function} factory - A function that populates the cache for a ticker. Called as factory(data, ticker)
 *
 * @returns {*} The cached value for the specified ticker and field
 *
 * @example
 * // First call - cache miss, factory is called
 * const price = getValue("AAPL", "PRICE", av_api_global_quote);
 *
 * // Second call - cache hit, factory is not called
 * const volume = getValue("AAPL", "VOLUME", av_api_global_quote);
 */
function getValue(cache, ticker, field, factory) {
  ticker = ticker.toUpperCase();
  field = field.toUpperCase();

  let data = cache[ticker];
  if (!data) {
    data = cache[ticker] = Object.create(null);
  }

  let result = data[field];
  if (result === undefined) {
    factory(data, ticker);
    result = data[field];
  }

  return result;
}

function evaluateSymbol(cache, ticker, symbol) {
  const handler = SYMBOL_TABLE[symbol];

  if (typeof handler === "function") {
    return handler(cache, ticker, symbol);
  }
  if (handler === undefined) {
    Logger.log(`⚠ Symbol not found: ${symbol}`);
    return "NaN";
  }

  return getValue(cache, ticker, ...handler);
}

function evaluateExpression(cache, ticker, expr) {
  // We assume expr is a proper JS expression.
  // We don't do any security ckeck!
  //
  // THIS CODE IS PRONE TO JS INJECTION
  //

  const IDENTIFIER_REGEX = /\b[0-9]*[A-Z_][A-Z0-9_]*\b/g;

  const trace = Object.create(null);
  const compiled = expr.replaceAll(IDENTIFIER_REGEX, (symbol) => {
    return (trace[symbol] = evaluateSymbol(cache, ticker, symbol));
  });

  /* eslint-disable no-eval */
  return [eval(compiled), trace];
  /* eslint-enable  no-eval */
}

//----------------------------------------------------------------------------
//  END COMMON EVALUATION INTERFACE
//----------------------------------------------------------------------------

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
  message.push(critical, `${title}\n\tNOT FOUND`);
}

/**
 *
 * @param {Message} message
 * @param {boolean} critical
 * @param {object} product
 */
function pushMessageUntracked(message, critical, product) {
  message.push(critical, `${product.title} × ${product.stock}\n\tUNTRACKED`);
}

function pushMessageCondition(message, condition, trace, action, product) {
  message.push(
    true,
    [
      `${product.title} × ${product.stock}`,
      `\t${condition}`,
      ...Object.entries(trace).map(
        ([symbol, value]) => `\t${symbol} = ${value}`
      ),
      `\t${action}`,
    ].join("\n")
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
      const ticker = row["Name"];
      const cache = Object.create(null);
      cache[ticker] = Object.create(null);
      cache[ticker]["PREV_STOCK"] = row["Stock"];
      cache[ticker]["STOCK"] = product.stock;
      cache[ticker]["MAX_PURCHASE"] = product.max_purchase;

      if (product.stock < 1.1 * product.max_purchase) {
        row["Status"] = "LOW STOCK";
      } else if (product.stock < row["Stock"]) {
        row["Status"] = "SELLING";
      } else {
        row["Status"] = product.status.toUpperCase();
      }
      cache[ticker]["STATUS"] = row["Status"];

      const condition = row["Condition"];
      const [trigger, trace] = evaluateExpression(cache, ticker, condition);

      if (trigger) {
        pushMessageCondition(message, condition, trace, row["Action"], product);
        row["Sent"] = today;
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
