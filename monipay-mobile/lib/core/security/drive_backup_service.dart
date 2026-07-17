import 'dart:convert';

import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;

import 'wallet_service.dart';

const String _backupFilename = 'monipay_wallet_backup.json';
const String _driveApiBase = 'https://www.googleapis.com/drive/v3';
const String _driveUploadBase = 'https://www.googleapis.com/upload/drive/v3';

/// Google Drive appDataFolder backup for encrypted wallet (matches web reference).
class DriveBackupService {
  DriveBackupService({
    GoogleSignIn? googleSignIn,
    WalletService? walletService,
  })  : _googleSignIn = googleSignIn ?? GoogleSignIn(scopes: ['https://www.googleapis.com/auth/drive.appdata']),
        _walletService = walletService ?? WalletService();

  final GoogleSignIn _googleSignIn;
  final WalletService _walletService;

  /// Sign in and return access token or null.
  Future<String?> signInAndGetAccessToken() async {
    final account = await _googleSignIn.signIn();
    if (account == null) return null;
    final auth = await account.authentication;
    return auth.accessToken;
  }

  /// Check if a backup already exists; returns timestamp if so.
  Future<({bool exists, int? timestamp})> checkBackupExists(String accessToken) async {
    try {
      final fileId = await _findBackupFile(accessToken);
      if (fileId == null) return (exists: false, timestamp: null);
      final resp = await http.get(
        Uri.parse('$_driveApiBase/files/$fileId?fields=modifiedTime'),
        headers: {'Authorization': 'Bearer $accessToken'},
      );
      if (!resp.statusCode.isOk) return (exists: true, timestamp: null);
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final modified = data['modifiedTime'] as String?;
      if (modified == null) return (exists: true, timestamp: null);
      final ms = DateTime.parse(modified).millisecondsSinceEpoch;
      return (exists: true, timestamp: ms);
    } catch (_) {
      return (exists: false, timestamp: null);
    }
  }

  /// Upload encrypted backup. Overwrite if [overwrite] and existing backup.
  Future<({bool success, String? error, int? timestamp})> uploadBackup({
    required String privateKeyHex,
    required String pin,
    required String accessToken,
    bool overwrite = false,
    String? payTag,
  }) async {
    try {
      final enc = await _walletService.encryptForBackup(privateKeyHex, pin);
      final backupContent = {
        'encryptedData': enc.encryptedData,
        'iv': enc.iv,
        'salt': enc.salt,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
        if (payTag != null) 'payTag': payTag,
      };
      final existingId = await _findBackupFile(accessToken);
      if (existingId != null && !overwrite) {
        return (success: false, error: 'Existing backup found', timestamp: null);
      }
      final body = utf8.encode(jsonEncode(backupContent));
      if (existingId != null) {
        final resp = await http.patch(
          Uri.parse('$_driveUploadBase/files/$existingId?uploadType=media'),
          headers: {
            'Authorization': 'Bearer $accessToken',
            'Content-Type': 'application/json',
          },
          body: body,
        );
        if (!resp.statusCode.isOk) {
          return (success: false, error: 'Failed to update backup', timestamp: null);
        }
      } else {
        final metadata = {
          'name': _backupFilename,
          'mimeType': 'application/json',
          'parents': ['appDataFolder'],
        };
        final boundary = 'backup_boundary_${DateTime.now().millisecondsSinceEpoch}';
        final multipart = [
          '--$boundary',
          'Content-Type: application/json; charset=UTF-8',
          '',
          jsonEncode(metadata),
          '--$boundary',
          'Content-Type: application/json',
          '',
          jsonEncode(backupContent),
          '--$boundary--',
        ].join('\r\n');
        final resp = await http.post(
          Uri.parse('$_driveUploadBase/files?uploadType=multipart'),
          headers: {
            'Authorization': 'Bearer $accessToken',
            'Content-Type': 'multipart/related; boundary=$boundary',
          },
          body: utf8.encode(multipart),
        );
        if (!resp.statusCode.isOk) {
          return (success: false, error: 'Failed to create backup', timestamp: null);
        }
      }
      final ts = backupContent['timestamp'] as int?;
      return (success: true, error: null, timestamp: ts);
    } catch (e) {
      return (success: false, error: e.toString(), timestamp: null);
    }
  }

  /// Download backup JSON; returns null if not found or error.
  Future<Map<String, dynamic>?> downloadBackup(String accessToken) async {
    try {
      final fileId = await _findBackupFile(accessToken);
      if (fileId == null) return null;
      final resp = await http.get(
        Uri.parse('$_driveApiBase/files/$fileId?alt=media'),
        headers: {'Authorization': 'Bearer $accessToken'},
      );
      if (!resp.statusCode.isOk) return null;
      return jsonDecode(resp.body) as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  /// Decrypt backup with PIN. Returns private key hex or null.
  Future<String?> decryptBackup({
    required Map<String, dynamic> backup,
    required String pin,
  }) async {
    try {
      final encryptedData = backup['encryptedData'] as String?;
      final iv = backup['iv'] as String?;
      final salt = backup['salt'] as String?;
      if (encryptedData == null || iv == null || salt == null) return null;
      return _walletService.decryptFromBackup(
        encryptedData: encryptedData,
        iv: iv,
        salt: salt,
        pin: pin,
      );
    } catch (_) {
      return null;
    }
  }

  Future<String?> _findBackupFile(String accessToken) async {
    try {
      final q = Uri.encodeComponent("name='$_backupFilename'");
      final resp = await http.get(
        Uri.parse('$_driveApiBase/files?spaces=appDataFolder&q=$q&fields=files(id,name,modifiedTime)'),
        headers: {'Authorization': 'Bearer $accessToken'},
      );
      if (!resp.statusCode.isOk) return null;
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final files = data['files'] as List<dynamic>?;
      if (files == null || files.isEmpty) return null;
      return (files.first as Map<String, dynamic>)['id'] as String?;
    } catch (_) {
      return null;
    }
  }
}

extension on int {
  bool get isOk => this >= 200 && this < 300;
}
