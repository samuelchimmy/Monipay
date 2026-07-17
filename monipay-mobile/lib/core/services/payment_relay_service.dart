import 'dart:convert';
import 'dart:typed_data';

import 'package:hashlib/hashlib.dart';
import 'package:http/http.dart' as http;
import 'package:web3dart/web3dart.dart';

import '../config/chain_configs.dart';

/// Supabase edge functions base (from config; use env in production).
String get _baseUrl => supabaseFunctionsUrl;

/// Lookup paytag to wallet address. Uses check-paytag with action: lookup (reference: PayTagContext.tsx).
Future<String?> lookupPayTag(String payTag, String supabaseAnonKey) async {
  final res = await http.post(
    Uri.parse('$_baseUrl/check-paytag'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $supabaseAnonKey',
    },
    body: jsonEncode({'action': 'lookup', 'payTag': payTag.trim().toLowerCase()}),
  );
  if (res.statusCode != 200) return null;
  final data = jsonDecode(res.body) as Map<String, dynamic>?;
  final profile = data?['profile'] as Map<String, dynamic>?;
  if (profile != null) {
    return (profile['wallet_address'] ?? profile['walletAddress']) as String?;
  }
  return null;
}

/// Get payment nonce for address and network. POST with getNonce (reference: wallet.ts). Fallback to timestamp on failure.
Future<BigInt> getPaymentNonce(String walletAddress, String network, String supabaseAnonKey) async {
  try {
    final res = await http.post(
      Uri.parse('$_baseUrl/relay-payment'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $supabaseAnonKey',
      },
      body: jsonEncode({
        'action': 'getNonce',
        'message': {'walletAddress': walletAddress},
        'network': network,
      }),
    );
    if (res.statusCode != 200) return BigInt.from(DateTime.now().millisecondsSinceEpoch);
    final data = jsonDecode(res.body) as Map<String, dynamic>?;
    final nonce = data?['nonce'];
    if (nonce == null) return BigInt.from(DateTime.now().millisecondsSinceEpoch);
    if (nonce is int) return BigInt.from(nonce);
    if (nonce is String) return BigInt.tryParse(nonce) ?? BigInt.from(DateTime.now().millisecondsSinceEpoch);
    return BigInt.from(DateTime.now().millisecondsSinceEpoch);
  } catch (_) {
    return BigInt.from(DateTime.now().millisecondsSinceEpoch);
  }
}

/// EIP-712 type hash for PaymentAuthorization (keccak256 of type string).
Uint8List _eip712PaymentAuthorizationTypeHash() {
  const typeString =
      'PaymentAuthorization(address from,address to,uint256 amount,uint256 fee,uint256 nonce,uint256 deadline)';
  return Uint8List.fromList(keccak256.convert(utf8.encode(typeString)).bytes);
}

/// EIP-712 type hash for EIP712Domain.
Uint8List _eip712DomainTypeHash() {
  const typeString =
      'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
  return Uint8List.fromList(keccak256.convert(utf8.encode(typeString)).bytes);
}

Uint8List _bytes32FromAddress(String address) {
  final hex = (address.startsWith('0x') ? address.substring(2) : address).toLowerCase();
  if (hex.length != 40) return Uint8List(32);
  final bytes = Uint8List(32);
  for (var i = 0; i < 20; i++) {
    bytes[12 + i] = int.parse(hex.substring(i * 2, (i + 1) * 2), radix: 16);
  }
  return bytes;
}

Uint8List _bytes32FromUint256(BigInt value) {
  final bytes = Uint8List(32);
  var v = value;
  for (var i = 31; i >= 0 && v > BigInt.zero; i--) {
    bytes[i] = (v & BigInt.from(0xff)).toInt();
    v = v >> 8;
  }
  return bytes;
}

Uint8List _bytes32FromKeccak256OfString(String s) {
  return Uint8List.fromList(keccak256.convert(utf8.encode(s)).bytes);
}

/// Build EIP-712 digest for PaymentAuthorization (domain + struct hash, then sign).
Uint8List buildEip712PaymentAuthorizationDigest({
  required String from,
  required String to,
  required BigInt amount,
  required BigInt fee,
  required BigInt nonce,
  required BigInt deadline,
  required int chainId,
  required String verifyingContract,
}) {
  final domainTypeHash = _eip712DomainTypeHash();
  final domainSeparator = Uint8List.fromList(keccak256.convert([
    ...domainTypeHash,
    ..._bytes32FromKeccak256OfString('MoniPay Router'),
    ..._bytes32FromKeccak256OfString('1'),
    ..._bytes32FromUint256(BigInt.from(chainId)),
    ..._bytes32FromAddress(verifyingContract),
  ]).bytes);

  final typeHash = _eip712PaymentAuthorizationTypeHash();
  final fromNorm = from.toLowerCase().startsWith('0x') ? from.toLowerCase() : '0x${from.toLowerCase()}';
  final toNorm = to.toLowerCase().startsWith('0x') ? to.toLowerCase() : '0x${to.toLowerCase()}';
  final structHash = Uint8List.fromList(keccak256.convert([
    ...typeHash,
    ..._bytes32FromAddress(fromNorm),
    ..._bytes32FromAddress(toNorm),
    ..._bytes32FromUint256(amount),
    ..._bytes32FromUint256(fee),
    ..._bytes32FromUint256(nonce),
    ..._bytes32FromUint256(deadline),
  ]).bytes);

  const prefix = [0x19, 0x01];
  return Uint8List.fromList(keccak256.convert([...prefix, ...domainSeparator, ...structHash]).bytes);
}

/// Sign payment authorization with EIP-712 (MoniPay Router domain). Returns hex signature.
String signPaymentAuthorization({
  required String privateKeyHex,
  required String from,
  required String to,
  required BigInt amount,
  required BigInt fee,
  required BigInt nonce,
  required BigInt deadline,
  required String network,
}) {
  final config = getChainConfig(network);
  if (config.monipayRouter.isEmpty) {
    throw ArgumentError('EIP-712 not supported for network: $network');
  }
  final digest = buildEip712PaymentAuthorizationDigest(
    from: from,
    to: to,
    amount: amount,
    fee: fee,
    nonce: nonce,
    deadline: deadline,
    chainId: config.id,
    verifyingContract: config.monipayRouter,
  );
  final key = EthPrivateKey.fromHex(privateKeyHex);
  final sigBytes = key.signToUint8List(digest);
  return '0x${sigBytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';
}

Future<BigInt> getAllowance({
  required String network,
  required String owner,
}) async {
  final config = getChainConfig(network);
  if (config.monipayRouter.isEmpty) return BigInt.zero;
  final ownerHex = owner.replaceFirst(RegExp(r'^0x', caseSensitive: false), '').padLeft(64, '0');
  final spenderHex =
      config.monipayRouter.replaceFirst(RegExp(r'^0x', caseSensitive: false), '').padLeft(64, '0');
  final data = '0xdd62ed3e$ownerHex$spenderHex';
  final body = {
    'jsonrpc': '2.0',
    'method': 'eth_call',
    'params': [
      {'to': config.token, 'data': data},
      'latest',
    ],
    'id': 1,
  };

  for (final rpc in config.rpcUrls) {
    try {
      final res = await http
          .post(
            Uri.parse(rpc),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 5));
      if (res.statusCode != 200) continue;
      final decoded = jsonDecode(res.body) as Map<String, dynamic>;
      final result = decoded['result'] as String?;
      if (result == null || result == '0x') continue;
      return BigInt.parse(
        result.replaceFirst(RegExp(r'^0x', caseSensitive: false), ''),
        radix: 16,
      );
    } catch (_) {}
  }
  return BigInt.zero;
}

/// Relay payment: POST action=relay with signature and message.
Future<Map<String, dynamic>?> relayPayment({
  required String signature,
  required Map<String, dynamic> message,
  required String senderProfileId,
  required String recipientPayTag,
  required String network,
  required String supabaseAnonKey,
  String? recipientAddress,
  List<Map<String, dynamic>>? items,
}) async {
  final res = await http.post(
    Uri.parse('$_baseUrl/relay-payment'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $supabaseAnonKey',
    },
    body: jsonEncode({
      'action': 'relay',
      'signature': signature,
      'message': message,
      'senderProfileId': senderProfileId,
      'recipientPayTag': recipientPayTag,
      'network': network,
      if (recipientAddress != null) 'recipientAddress': recipientAddress,
      if (items != null) 'items': items,
    }),
  );
  if (res.statusCode != 200) return null;
  try {
    return jsonDecode(res.body) as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
}
