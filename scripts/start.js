const { spawn } = require('child_process');

const port = process.env.PORT || '3000';
const child = spawn('npx', ['next', 'start', '-p', port], {
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code));
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
