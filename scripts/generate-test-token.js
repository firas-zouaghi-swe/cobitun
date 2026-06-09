const { createHmac } = require('crypto');

const JWT_SECRET = 'cobitun-jwt-secret-2025-secure-key-f1r4s';

function base64UrlEncode(str) {
  const buffer = typeof str === 'string' ? Buffer.from(str) : Buffer.from(JSON.stringify(str));
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(input) {
  const signature = createHmac('sha256', JWT_SECRET)
    .update(input)
    .digest();
  return signature
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  sub: '2',  // User ID 2 (ahmed.b, first customer)
  role: 'CUSTOMER',
  sessionId: 'sess-y0rf6jn7sch',  // Active session for user 2
  email: 'ahmed.benali@techvision.tn',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900  // 15 minutes
};

const encodedHeader = base64UrlEncode(header);
const encodedPayload = base64UrlEncode(payload);
const signature = sign(`${encodedHeader}.${encodedPayload}`);
const token = `${encodedHeader}.${encodedPayload}.${signature}`;

console.log('Generated JWT Token:');
console.log(token);
console.log('\nPayload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\nUsage:');
console.log('curl -H "Authorization: Bearer ' + token + '" http://localhost:3000/api/customer/dashboard');
