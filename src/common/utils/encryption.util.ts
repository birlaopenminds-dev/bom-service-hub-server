import * as bcrypt from 'bcrypt';

export class EncryptionUtil {
  private static readonly SALT_ROUNDS = 12;

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async comparePassword(
    plainText: string,
    hashedText: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainText, hashedText);
  }
}
