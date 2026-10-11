#!/usr/bin/env node
if (process.argv.includes('--no-color')) {
  process.env.NO_COLOR = '1';
}

import { runCli } from '../dist/cli/index.js';

runCli(process.argv.slice(2));
