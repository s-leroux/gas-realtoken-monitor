const REALT_PRODUCTS_ENDPOINT = "https://realt.co/wp-json/realt/v1/products/for_sale"
const AV_API_KEY =
  PropertiesService.getScriptProperties().getProperty("USER_EMAIL");

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function loadSheet(sheetName){
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

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


  return [headers, ranges, columns]
}


function update() {
  const today = toDateOnly(new Date())
  const [headers, ranges, columns] = loadSheet("Monitor")

  for(let i = 0; i < columns["Name"].length; ++i) {
    if (today > sentColumn[i]) {
      columns["Checked"][i] = today
    }
  }

  for(const header of ["Status", "Stock", "Max Purchase", "Checked", "Sent"]) {
    ranges[header].setValues(columns[header].map((x) => [x]));
  }
}
