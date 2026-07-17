import 'dart:convert';
import 'dart:typed_data';

import 'package:pointycastle/export.dart';

class InvalidPinException implements Exception {
  InvalidPinException([this.message = 'Invalid PIN']);
  final String message;

  @override
  String toString() => message;
}

class WalletCryptoService {
  WalletCryptoService._();

  static const int _saltLength = 16;
  static const int _ivLength = 12;
  static const int _iterations = 100000;
  static const int _keyLength = 32;
  static const String _legacyEncryptionKey = 'MoniPay2024BaseChain';

  static Uint8List _deriveKey(String pin, Uint8List salt) {
    final derivator = PBKDF2KeyDerivator(HMac(SHA256Digest(), 64));
    derivator.init(Pbkdf2Parameters(salt, _iterations, _keyLength));
    return derivator.process(Uint8List.fromList(utf8.encode(pin)));
  }

  static String decryptPrivateKey(String encrypted, String pin) {
    final String result;
    if (encrypted.startsWith('v2:')) {
      result = _decryptV2(encrypted.substring(3), pin);
    } else if (encrypted.startsWith('v1:')) {
      result = _decryptV1(encrypted.substring(3), pin);
    } else {
      result = _decryptLegacy(encrypted, pin);
    }
    if (!_isValidPrivateKeyHex(result)) {
      throw InvalidPinException();
    }
    return result;
  }

  static String _decryptV2(String b64, String pin) {
    final data = base64Decode(b64);
    if (data.length < _saltLength + _ivLength + 1) {
      throw InvalidPinException();
    }
    final salt = Uint8List.sublistView(data, 0, _saltLength);
    final iv = Uint8List.sublistView(data, _saltLength, _saltLength + _ivLength);
    final cipherText = Uint8List.sublistView(data, _saltLength + _ivLength);
    final key = _deriveKey(pin, salt);
    final cipher = GCMBlockCipher(AESEngine());
    cipher.init(false, AEADParameters(KeyParameter(key), 128, iv, Uint8List(0)));
    try {
      return utf8.decode(cipher.process(cipherText));
    } catch (_) {
      throw InvalidPinException();
    }
  }

  static String _decryptV1(String b64, String pin) {
    final data = base64Decode(b64);
    if (data.length < _saltLength + _ivLength + 1) {
      throw InvalidPinException();
    }
    final salt = Uint8List.sublistView(data, 0, _saltLength);
    final iv = Uint8List.sublistView(data, _saltLength, _saltLength + _ivLength);
    final cipherText = Uint8List.sublistView(data, _saltLength + _ivLength);
    final pinBytes = Uint8List.fromList(utf8.encode(pin));
    if (pinBytes.isEmpty) throw InvalidPinException();

    final keyBytes = Uint8List(32);
    for (var i = 0; i < 32; i++) {
      keyBytes[i] =
          (salt[i % _saltLength] ^ pinBytes[i % pinBytes.length] ^ (i * 17)) & 0xff;
    }
    final out = Uint8List(cipherText.length);
    for (var i = 0; i < cipherText.length; i++) {
      out[i] = (cipherText[i] ^ keyBytes[i % 32] ^ iv[i % _ivLength]) & 0xff;
    }
    try {
      return utf8.decode(out);
    } catch (_) {
      throw InvalidPinException();
    }
  }

  static String _decryptLegacy(String encrypted, String pin) {
    final combined = utf8.encode('$_legacyEncryptionKey$pin');
    if (combined.isEmpty) throw InvalidPinException();
    late final List<int> decoded;
    try {
      decoded = base64Decode(encrypted);
    } catch (_) {
      throw InvalidPinException();
    }
    final out = Uint8List(decoded.length);
    for (var i = 0; i < decoded.length; i++) {
      out[i] = (decoded[i] ^ combined[i % combined.length]) & 0xff;
    }
    try {
      return utf8.decode(out);
    } catch (_) {
      throw InvalidPinException();
    }
  }

  static bool _isValidPrivateKeyHex(String value) {
    final cleaned = value.startsWith('0x') ? value.substring(2) : value;
    return RegExp(r'^[a-fA-F0-9]{64}$').hasMatch(cleaned);
  }
}

