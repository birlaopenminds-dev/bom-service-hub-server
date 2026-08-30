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

    // 1. Standard Bcrypt check ($2a$, $2b$, $2y$)
    if (
      trimmedHash.startsWith('$2a$') ||
      trimmedHash.startsWith('$2b$') ||
      trimmedHash.startsWith('$2y$')
    ) {
      try {
        const isMatch = await bcrypt.compare(plainText, trimmedHash);
        if (isMatch) return true;

        // Fallback: Check if PHP double-hashed or md5-hashed before bcrypt
        const md5OfPlain = crypto.createHash('md5').update(plainText).digest('hex');
        const isMd5BcryptMatch = await bcrypt.compare(md5OfPlain, trimmedHash);
        if (isMd5BcryptMatch) return true;
      } catch (err) {
        // Continue to legacy checks if bcrypt compare errors out
      }
    }

    // 2. Legacy MD5 hash check (32 hex characters)
    if (trimmedHash.length === 32 && /^[a-fA-F0-9]{32}$/.test(trimmedHash)) {
      const md5Hash = crypto.createHash('md5').update(plainText).digest('hex');
      if (md5Hash.toLowerCase() === trimmedHash.toLowerCase()) {
        return true;
      }
    }

    // 3. Legacy SHA1 hash check (40 hex characters)
    if (trimmedHash.length === 40 && /^[a-fA-F0-9]{40}$/.test(trimmedHash)) {
      const sha1Hash = crypto.createHash('sha1').update(plainText).digest('hex');
      if (sha1Hash.toLowerCase() === trimmedHash.toLowerCase()) {
        return true;
      }
    }

    // 4. Plaintext fallback (if legacy DB stored unhashed strings)
    if (plainText === trimmedHash) {
      return true;
    }

    return false;
  }
}
