const REALT_PRODUCTS_ENDPOINT =
  "https://realt.co/wp-json/realt/v1/products/for_sale";

const USER_EMAIL =
  PropertiesService.getScriptProperties().getProperty("USER_EMAIL");

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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

function pushMessageProductNotFound(messages, title) {
  messages.push(`NOT FOUND: ${title}`);
}

function pushMessageLowStock(messages, product) {
  messages.push(`LOW STOCK: ${product.title} × ${product.stock}`);
}

function update() {
  const today = toDateOnly(new Date());
  const [headers, ranges, columns] = loadSheet("Monitor");
  const productsForSale = loadProductsForSale();
  const dataTime = new Date(productsForSale.time * 1000);

  const messages = [];

  for (let i = 0; i < columns["Name"].length; ++i) {
    const product = findProduct(productsForSale, columns["Name"][i]);
    columns["Checked"][i] = dataTime;
    if (!product) {
      if (today > columns["Sent"][i]) {
        pushMessageProductNotFound(messages, columns["Name"][i]);
      }
      columns["Status"][i] = "NOT FOUND";
      columns["Stock"][i] = 0;
      columns["Max Purchase"][i] = 0;
      columns["Sent"][i] = today;
    } else if (today > columns["Sent"][i]) {
      columns["Stock"][i] = product.stock;
      columns["Max Purchase"][i] = product.max_purchase;

      if (product.stock < 1.1 * product.max_purchase) {
        pushMessageLowStock(messages, product);
        columns["Status"][i] = "LOW STOCK";
        columns["Sent"][i] = today;
      } else {
        columns["Status"][i] = product.status.toUpperCase();
      }
    }
  }

  if (messages.length) {
    MailApp.sendEmail({
      to: USER_EMAIL,
      subject: `⚠️ Realt Alert`,
      body: messages.join("\n"),
    });
  }

  // Update columns
  for (const header of ["Status", "Stock", "Max Purchase", "Checked", "Sent"]) {
    ranges[header].setValues(columns[header].map((x) => [x]));
  }
}
