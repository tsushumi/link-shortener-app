const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, toCsv } = require('../utils/csv');
const { parseBrowser, summarizeBrowsers } = require('../utils/userAgent');
const { lastNDays, fillSeries } = require('../utils/analytics');

test('parseCsv handles quotes, escaped quotes, CRLF, BOM and blank lines', () => {
  const rows = parseCsv('﻿url,note\r\n"https://a.com/?x=1,2","say ""hi"""\r\n\r\nb,c\n');
  assert.deepEqual(rows, [['url', 'note'], ['https://a.com/?x=1,2', 'say "hi"'], ['b', 'c']]);
});

test('parseCsv handles newlines inside quotes and a missing trailing newline', () => {
  assert.deepEqual(parseCsv('a,"line1\nline2"\nz'), [['a', 'line1\nline2'], ['z']]);
});

test('toCsv quotes special characters and neutralises formulas', () => {
  const csv = toCsv(['a', 'b'], [['x,y', '=1+1'], ['say "hi"', '@cmd']]);
  assert.equal(csv, 'a,b\r\n"x,y",\'=1+1\r\n"say ""hi""",\'@cmd\r\n');
});

test('parseBrowser recognises common browsers in the right order', () => {
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  assert.equal(parseBrowser(chrome), 'Chrome');
  assert.equal(parseBrowser(chrome + ' Edg/126.0.0.0'), 'Edge');
  assert.equal(parseBrowser(chrome + ' OPR/110.0.0.0'), 'Opera');
  assert.equal(parseBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'), 'Firefox');
  assert.equal(parseBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'), 'Safari');
  assert.equal(parseBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1'), 'Chrome');
  assert.equal(parseBrowser('Googlebot/2.1 (+http://www.google.com/bot.html)'), 'Bot');
  assert.equal(parseBrowser('curl/8.5.0'), 'API client');
  assert.equal(parseBrowser(null), 'Unknown');
  assert.equal(parseBrowser('something strange'), 'Other');
});

test('summarizeBrowsers merges user agents of the same browser', () => {
  const out = summarizeBrowsers([
    { ua: 'Mozilla/5.0 Chrome/1 Safari/1', clicks: 2 },
    { ua: 'Mozilla/5.0 Chrome/2 Safari/2', clicks: 3 },
    { ua: null, clicks: 1 },
  ]);
  assert.deepEqual(out, [{ browser: 'Chrome', clicks: 5 }, { browser: 'Unknown', clicks: 1 }]);
});

test('lastNDays returns n consecutive dates and fillSeries zero-fills', () => {
  const days = lastNDays(7, 'UTC');
  assert.equal(days.length, 7);
  assert.equal(new Set(days).size, 7);
  const series = fillSeries(days, [{ day: days[6], clicks: 4 }]);
  assert.deepEqual(series.map((d) => d.clicks), [0, 0, 0, 0, 0, 0, 4]);
});
