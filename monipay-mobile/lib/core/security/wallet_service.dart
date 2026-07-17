import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:bcrypt/bcrypt.dart';
import 'package:pointycastle/export.dart';
import 'package:web3dart/web3dart.dart';
import 'wallet_crypto_service.dart';

/// Top-level for [compute] to run encryption off the main isolate (avoids 100k PBKDF2 freeze).
String encryptPrivateKeyInIsolate(List<dynamic> args) {
  final key = args[0] as String;
  final pin = args[1] as String;
  return WalletService().encryptPrivateKey(key, pin);
}

/// Top-level for [compute]: decrypt private key (100k PBKDF2 + AES-GCM) off UI thread.
/// args: [encryptedKey, pin]  →  returns decrypted hex string.
String decryptPrivateKeyInIsolate(List<dynamic> args) {
  return WalletService().decryptPrivateKey(args[0] as String, args[1] as String);
}

/// Top-level for [compute]: BCrypt verify + AES-GCM decrypt in a single isolate
/// so the UI thread is never blocked by either operation.
/// args: [pin, bcryptHash, encryptedKey]
/// returns: [bool verified, String? decryptedKey]
List<dynamic> verifyAndDecryptInIsolate(List<dynamic> args) {
  final pin        = args[0] as String;
  final hash       = args[1] as String;
  final encrypted  = args[2] as String;
  final verified   = BCrypt.checkpw(pin, hash);
  if (!verified) return [false, null];
  try {
    final key = WalletService().decryptPrivateKey(encrypted, pin);
    return [true, key];
  } catch (_) {
    return [false, null];
  }
}

/// Wallet generation and AES-GCM encryption matching _web_reference/src/lib/wallet.ts.
/// PBKDF2-SHA256 100k iterations, 16-byte salt, 12-byte IV, format v2:base64(salt+iv+cipher).
class WalletService {
  WalletService() : _random = Random.secure();

  final Random _random;
  static const int _saltLength = 16;
  static const int _ivLength = 12;
  static const int _iterations = 100000;
  static const int _keyLength = 32;

  /// Generate a new EVM wallet (Base).
  ({String privateKeyHex, String address}) generateEvmWallet() {
    final key = EthPrivateKey.createRandom(_random);
    final address = key.address.hex;
    final bytes = key.privateKey;
    final hex = '0x${bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';
    return (privateKeyHex: hex, address: address);
  }

  /// Derive AES-256 key from PIN using PBKDF2-SHA256.
  Uint8List _deriveKey(String pin, Uint8List salt) {
    final derivator = PBKDF2KeyDerivator(HMac(SHA256Digest(), 64));
    derivator.init(Pbkdf2Parameters(salt, _iterations, _keyLength));
    return derivator.process(Uint8List.fromList(utf8.encode(pin)));
  }

  /// Encrypt private key with PIN. Returns v2:base64(salt+iv+ciphertext).
  String encryptPrivateKey(String privateKeyHex, String pin) {
    final salt = Uint8List.fromList(List.generate(_saltLength, (_) => _random.nextInt(256)));
    final iv = Uint8List.fromList(List.generate(_ivLength, (_) => _random.nextInt(256)));
    final key = _deriveKey(pin, salt);

    final cipher = GCMBlockCipher(AESEngine());
    cipher.init(true, AEADParameters(KeyParameter(key), 128, iv, Uint8List(0)));

    final plain = Uint8List.fromList(utf8.encode(privateKeyHex));
    final cipherText = cipher.process(plain);

    final combined = Uint8List(salt.length + iv.length + cipherText.length);
    combined.setRange(0, salt.length, salt);
    combined.setRange(salt.length, salt.length + iv.length, iv);
    combined.setRange(salt.length + iv.length, combined.length, cipherText);

    return 'v2:${base64Encode(combined)}';
  }

  static const String _legacyEncryptionKey = 'MoniPay2024BaseChain';

  /// Decrypt private key. Supports v2 (AES-GCM), v1 (XOR derived key), and legacy (XOR with key+pin). Reference: wallet.ts.
  String decryptPrivateKey(String encrypted, String pin) {
    return WalletCryptoService.decryptPrivateKey(encrypted, pin);
  }

  String _decryptLegacy(String encrypted, String pin) {
    final combined = utf8.encode('$_legacyEncryptionKey$pin');
    List<int> decoded;
    try {
      decoded = base64Decode(encrypted);
    } catch (_) {
      throw ArgumentError('Invalid legacy encrypted data');
    }
    final decrypted = Uint8List(decoded.length);
    for (var i = 0; i < decoded.length; i++) {
      decrypted[i] = (decoded[i] ^ combined[i % combined.length]) & 0xff;
    }
    return utf8.decode(decrypted);
  }

  /// Encrypt for backup (same as encryptPrivateKey; used by Drive backup).
  Future<({String encryptedData, String iv, String salt})> encryptForBackup(
    String privateKeyHex,
    String pin,
  ) async {
    final salt = Uint8List.fromList(List.generate(_saltLength, (_) => _random.nextInt(256)));
    final iv = Uint8List.fromList(List.generate(_ivLength, (_) => _random.nextInt(256)));
    final key = _deriveKey(pin, salt);

    final cipher = GCMBlockCipher(AESEngine());
    cipher.init(true, AEADParameters(KeyParameter(key), 128, iv, Uint8List(0)));
    final plain = Uint8List.fromList(utf8.encode(privateKeyHex));
    final cipherText = cipher.process(plain);

    return (
      encryptedData: base64Encode(cipherText),
      iv: base64Encode(iv),
      salt: base64Encode(salt),
    );
  }

  /// Decrypt from backup.
  Future<String> decryptFromBackup({
    required String encryptedData,
    required String iv,
    required String salt,
    required String pin,
  }) async {
    final saltBytes = base64Decode(salt);
    final ivBytes = base64Decode(iv);
    final cipherText = base64Decode(encryptedData);
    final key = _deriveKey(pin, Uint8List.fromList(saltBytes));

    final cipher = GCMBlockCipher(AESEngine());
    cipher.init(false, AEADParameters(KeyParameter(key), 128, Uint8List.fromList(ivBytes), Uint8List(0)));
    final decrypted = cipher.process(Uint8List.fromList(cipherText));
    return utf8.decode(decrypted);
  }
}
