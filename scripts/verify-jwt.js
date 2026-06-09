const { createHmac } = require('crypto');

const JWT_SECRET = 'dev-jwt-secret';

function base64UrlEncode(str) {
  const buffer = typeof str === 'string' ? Buffer.from(str) : Buffer.from(JSON.stringify(str));
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
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

// The token that will be sent
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwicm9sZSI6IkNVU1RPTUVSIiwic2Vzc2lvbklkIjoic2Vzcy15MHJmNmpuN3NjaCIsImVtYWlsIjoiYWhtZWQuYmVuYWxpQHRlY2h2aXNpb24udG4iLCJpYXQiOjE3ODEwMTQ0NzAsImV4cCI6MTc4MTAxNTM3MH0.ojOKMmNPL9OddhunHD5dGbm2qsnWi2PReAXJJ--DziQ';

console.log('Verifying JWT Token\n');
console.log('Token:', token);
console.log();

const parts = token.split('.');
if (parts.length !== 3) {
  console.log('✗ Token does not have 3 parts');
  process.exit(1);
}

const [encodedHeader, encodedPayload, signature] = parts;

console.log('Encoded Header:', encodedHeader);
console.log('Encoded Payload:', encodedPayload);
console.log('Signature:', signature);
console.log();

// Decode and verify
try {
  const header = JSON.parse(base64UrlDecode(encodedHeader));
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  
  console.log('Decoded Header:', header);
  console.log('Decoded Payload:', payload);
  console.log();

  // Recalculate signature
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  console.log('Expected Signature:', expectedSignature);
  console.log('Provided Signature:', signature);
  console.log();

  if (signature === expectedSignature) {
    console.log('✓ Signature VALID');
    
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp > now) {
      console.log('✓ Token not expired');
    } else {
      console.log('✗ Token is expired');
    }
  } else {
    console.log('✗ Signature INVALID');
    console.log('  This means the JWT was not signed with the same secret');
    console.log('  or was tampered with');
  }
} catch (err) {
  console.log('✗ Error decoding token:', err.message);
}
