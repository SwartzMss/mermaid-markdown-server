function parseArgs(argv) {
  const options = {
    file: 'README.md',
    port: 3000,
    host: '0.0.0.0',
    help: false
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--port' || arg === '-p') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--port requires a value');
      }
      options.port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg === '--host') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--host requires a value');
      }
      options.host = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (positional.length > 1) {
    throw new Error('only one markdown file can be provided');
  }

  if (positional.length === 1) {
    options.file = positional[0];
  }

  options.port = parsePort(String(options.port));
  return options;
}

function parsePort(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error('port must be a number');
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('port must be between 1 and 65535');
  }

  return port;
}

function usage() {
  return `Usage: mermaid-markdown-server [file.md] [--port 3000] [--host 0.0.0.0]

Options:
  -p, --port <port>  Port to listen on. Default: 3000
      --host <host>  Host to bind. Use 0.0.0.0 for LAN access. Default: 0.0.0.0
  -h, --help         Show this help message
`;
}

module.exports = { parseArgs, usage };
