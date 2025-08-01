# RealToken sell monitor

This project hosts a Google Apps Script that monitors RealToken on the primary market (RealT web site).
It updates the associated Google Sheet and send an email when stock becomes low so you don't have to monitor yourself if you want to keep your money on the RMM until the last moment.
The `Code.js` file contains the GAS implementation and the `test` directory holds unit tests that exercise this code locally using Mocha and Chai.

## Setup

Install dependencies with `npm install`.

## Running Tests

Use `npm test` to execute the unit tests.

## Deployment

Push the script to Google Apps Script using `clasp push`.
