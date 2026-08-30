import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export class EncryptionUtil {
  private static readonly SALT_ROUNDS = 12;

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async comparePassword(
    plainText: string,
    hashedText: string,
  ): Promise<boolean> {
    if (!plainText || !hashedText) return false;

    const trimmedHash = hashedText.trim();

    // 1. Direct Bcrypt comparison ($2b$, $2a$, $2y$)
    try {
      const isMatch = await bcrypt.compare(plainText, trimmedHash);
      if (isMatch) return true;
    } catch (err) {
      // Continue to compatibility checks
    }

    // 2. PHP $2y$ to Node.js $2a$ / $2b$ Bcrypt Compatibility Fix
    // PHP password_hash produces $2y$, while some Node.js bcrypt libraries require $2a$ or $2b$
    if (trimmedHash.startsWith('$2y$')) {
      try {
        const hash2a = trimmedHash.replace(/^\$2y\$/, '$2a$');
        if (await bcrypt.compare(plainText, hash2a)) {
          return true;
        }
      } catch (err) {}

      try {
        const hash2b = trimmedHash.replace(/^\$2y\$/, '$2b$');
        if (await bcrypt.compare(plainText, hash2b)) {
          return true;
        }
      } catch (err) {}
    }

    // 3. Check if input was MD5 hashed before Bcrypt (PHP custom login pattern)
    const md5OfPlain = crypto.createHash('md5').update(plainText).digest('hex');
    try {
      if (await bcrypt.compare(md5OfPlain, trimmedHash)) return true;
      if (trimmedHash.startsWith('$2y$')) {
        if (await bcrypt.compare(md5OfPlain, trimmedHash.replace(/^\$2y\$/, '$2a$'))) return true;
        if (await bcrypt.compare(md5OfPlain, trimmedHash.replace(/^\$2y\$/, '$2b$'))) return true;
      }
    } catch (err) {}

    // 4. Legacy MD5 check (32 hex chars)
    if (trimmedHash.length === 32 && /^[a-fA-F0-9]{32}$/.test(trimmedHash)) {
      if (md5OfPlain.toLowerCase() === trimmedHash.toLowerCase()) {
        return true;
      }
    }

    // 5. Legacy SHA1 check (40 hex chars)
    if (trimmedHash.length === 40 && /^[a-fA-F0-9]{40}$/.test(trimmedHash)) {
      const sha1Hash = crypto.createHash('sha1').update(plainText).digest('hex');
      if (sha1Hash.toLowerCase() === trimmedHash.toLowerCase()) {
        return true;
      }
    }

    // 6. Plaintext fallback
    if (plainText === trimmedHash) {
      return true;
    }

    return false;
  }
}
