const { createJwt, verifyJwt } = require('./src/lib/jwt');

console.log('Testing JWT creation and verification...\n');

// Create a JWT
const payload = {
  sub: '2',
  role: 'CUSTOMER',
  sessionId: 'sess-y0rf6jn7sch',
  email: 'ahmed.benali@techvision.tn',
};

const token = createJwt(payload);
console.log('Created token:');
console.log(token);
console.log();

// Verify the token
const verified = verifyJwt(token);
console.log('Verified payload:');
console.log(verified);
console.log();

if (verified && verified.sub === '2') {
  console.log('✓ JWT verification PASSED');
} else {
  console.log('✗ JWT verification FAILED');
}
