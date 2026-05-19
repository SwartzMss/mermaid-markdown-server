#!/usr/bin/env node
const { parseArgs, usage } = require('./options');
const { createMarkdownServer } = require('./server');

function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error('');
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  const server = createMarkdownServer({ file: options.file });

  server.listen(options.port, options.host, () => {
    const shownHost = options.host === '0.0.0.0' ? 'localhost' : options.host;
    console.log(`Serving ${options.file}`);
    console.log(`Local:   http://${shownHost}:${options.port}`);
    if (options.host === '0.0.0.0') {
      console.log(`LAN:     http://<your-computer-ip>:${options.port}`);
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = { main };
