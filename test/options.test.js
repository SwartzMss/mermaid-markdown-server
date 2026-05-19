const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('../src/options');

test('parseArgs uses README.md, port 3000, and host 0.0.0.0 by default', () => {
  const options = parseArgs([]);

  assert.equal(options.file, 'README.md');
  assert.equal(options.port, 3000);
  assert.equal(options.host, '0.0.0.0');
});

test('parseArgs accepts file, port, and host options', () => {
  const options = parseArgs(['docs/guide.md', '--port', '4567', '--host', '127.0.0.1']);

  assert.equal(options.file, 'docs/guide.md');
  assert.equal(options.port, 4567);
  assert.equal(options.host, '127.0.0.1');
});

test('parseArgs rejects invalid ports', () => {
  assert.throws(
    () => parseArgs(['README.md', '--port', '99999']),
    /port must be between 1 and 65535/
  );
});
