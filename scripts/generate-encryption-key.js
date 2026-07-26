#!/usr/bin/env node
/**
 * Generate Encryption Key
 *
 * Generates a secure AES-256-GCM encryption key for provider configurations.
 * Usage: npm run generate-encryption-key
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require('crypto');

function generateKey() {
  // Generate a random 256-bit (32-byte) key
  const key = crypto.randomBytes(32);

  // Encode as base64 for easy storage in environment variables
  const keyBase64 = key.toString('base64');

  console.log('Generated Provider Encryption Key:');
  console.log('');
  console.log(`PROVIDER_ENCRYPTION_KEY=${keyBase64}`);
  console.log('');
  console.log('Add this to your .env.local or .env file.');
  console.log('');
  console.log('IMPORTANT SECURITY NOTES:');
  console.log('- Keep this key secure and never commit it to version control');
  console.log('- Use the same key across all application instances');
  console.log('- Back up this key - you cannot decrypt existing data without it');
  console.log('- If you lose this key, you will need to reconfigure all providers');
  console.log('');
}

// Test encryption functionality
function testEncryption(key) {
  try {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const testData = 'test-encryption-data';

    // Encrypt
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(testData, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Decrypt
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    if (decrypted === testData) {
      console.log('✅ Encryption test passed');
      return true;
    } else {
      console.log('❌ Encryption test failed: data mismatch');
      return false;
    }
  } catch (error) {
    console.log(`❌ Encryption test failed: ${error.message}`);
    return false;
  }
}

function main() {
  const keyBuffer = crypto.randomBytes(32);

  console.log('🔐 DerList Provider Encryption Key Generator');
  console.log('='.repeat(50));
  console.log('');

  // Test the generated key
  if (!testEncryption(keyBuffer)) {
    console.error('Failed to generate a working encryption key. Please try again.');
    process.exit(1);
  }

  console.log('');
  generateKey();
}

if (require.main === module) {
  main();
}
