import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../../app/theme/app_theme.dart';
import '../../../../core/config/chain_configs.dart';
import '../../../auth/presentation/splash_screen.dart' show secureStorageServiceProvider;
import '../dashboard_controller.dart';
import '../dashboard_state.dart';
import 'transaction_receipt_modal.dart';

const _productsUrl = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/products';
const _productsStorageKey = 'monipay_products';
const _platformFeePercent = 0.01;

/// Default quick-add products when API returns none.
final _defaultProducts = [
  MerchantProduct(id: '1', name: 'Coffee', price: 5.00),
  MerchantProduct(id: '2', name: 'Snack', price: 3.50),
  MerchantProduct(id: '3', name: 'Meal', price: 12.00),
];

class MerchantProduct {
  MerchantProduct({required this.id, required this.name, required this.price});
  final String id;
  final String name;
  final double price;
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'price': price};
  static MerchantProduct fromJson(Map<String, dynamic> j) {
    return MerchantProduct(
      id: j['id']?.toString() ?? '',
      name: j['name']?.toString() ?? 'Item',
      price: (j['price'] is num) ? (j['price'] as num).toDouble() : 0.0,
    );
  }
}

class CartItem {
  CartItem({required this.product, required this.quantity});
  final MerchantProduct product;
  int quantity;
}

/// Merchant charge screen: numpad, quick-add products, cart, charge QR, payment detection, recent sales.
class MerchantDashboard extends ConsumerStatefulWidget {
  const MerchantDashboard({
    super.key,
    required this.transactions,
  });

  final List<DashboardTransaction> transactions;

  @override
  ConsumerState<MerchantDashboard> createState() => _MerchantDashboardState();
}

class _MerchantDashboardState extends ConsumerState<MerchantDashboard> {
  String _amount = '0';
  List<CartItem> _cart = [];
  List<MerchantProduct> _products = [];
  bool _productsLoaded = false;
  bool _showQR = false;
  String _qrMode = 'monipay'; // 'monipay' | 'external'
  int? _qrOpenReceivedCount;
  bool _isPaid = false;
  String? _paidByPayTag;
  double _paidAmount = 0;
  Timer? _pollTimer;

  List<DashboardTransaction> get _merchantTransactions {
    return widget.transactions.where((tx) {
      if (tx.type != 'received') return false;
      final src = tx.source?.toLowerCase();
      return src != 'monibot_p2p' && src != 'monibot_grant';
    }).toList();
  }

  double get _numericAmount {
    final n = double.tryParse(_amount);
    return n ?? 0;
  }

  double get _fee => _numericAmount * _platformFeePercent;
  double get _merchantReceives => _numericAmount - _fee;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadProducts());
  }

  Future<void> _loadProducts() async {
    final profileId = ref.read(dashboardControllerProvider).profileId;
    if (profileId == null || profileId.isEmpty) return;
    if (_productsLoaded) return;
    final storage = ref.read(secureStorageServiceProvider);
    try {
      final response = await http.post(
        Uri.parse(_productsUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'action': 'list', 'profileId': profileId}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>?;
        final list = data?['products'] as List<dynamic>?;
        if (list != null && list.isNotEmpty) {
          final products = list
              .map((e) => MerchantProduct.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList();
          if (mounted) {
            setState(() {
              _products = products;
              _productsLoaded = true;
            });
            await storage.write(key: _productsStorageKey, value: jsonEncode(products.map((p) => p.toJson()).toList()));
          }
          return;
        }
      }
    } catch (_) {}
    final saved = await storage.read(key: _productsStorageKey);
    if (saved != null) {
      try {
        final list = jsonDecode(saved) as List<dynamic>?;
        if (list != null && list.isNotEmpty && mounted) {
          setState(() {
            _products = list.map((e) => MerchantProduct.fromJson(Map<String, dynamic>.from(e as Map))).toList();
            _productsLoaded = true;
          });
          return;
        }
      } catch (_) {}
    }
    if (mounted) {
      setState(() {
        _products = List.from(_defaultProducts);
        _productsLoaded = true;
      });
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _handleNumberClick(String key) {
    if (key == 'del') {
      _handleDelete();
      return;
    }
    setState(() {
      if (_amount == '0' && key != '.') {
        _amount = key;
        return;
      }
      if (key == '.' && _amount.contains('.')) return;
      if (_amount.contains('.')) {
        final parts = _amount.split('.');
        if (parts.length == 2 && parts[1].length >= 2) return;
      }
      _amount = _amount + key;
    });
  }

  void _handleDelete() {
    setState(() {
      if (_amount.length == 1) {
        _amount = '0';
      } else {
        _amount = _amount.substring(0, _amount.length - 1);
      }
    });
  }

  void _handleClear() {
    setState(() {
      _amount = '0';
      _cart = [];
    });
  }

  void _handleQuickProduct(MerchantProduct product) {
    setState(() {
      final idx = _cart.indexWhere((e) => e.product.id == product.id);
      if (idx >= 0) {
        _cart[idx].quantity++;
      } else {
        _cart.add(CartItem(product: product, quantity: 1));
      }
      final current = double.tryParse(_amount) ?? 0;
      _amount = (current + product.price).toStringAsFixed(2);
    });
  }

  void _handleRemoveFromCart(String productId) {
    final idx = _cart.indexWhere((e) => e.product.id == productId);
    if (idx < 0) return;
    final item = _cart[idx];
    setState(() {
      if (item.quantity == 1) {
        _cart.removeAt(idx);
      } else {
        item.quantity--;
      }
      final current = double.tryParse(_amount) ?? 0;
      _amount = (current - item.product.price).clamp(0.0, double.infinity).toStringAsFixed(2);
    });
  }

  void _openChargeQR() {
    if (_numericAmount < 0.01) return;
    setState(() {
      _showQR = true;
      _isPaid = false;
      _paidByPayTag = null;
      _paidAmount = 0;
      _qrOpenReceivedCount = widget.transactions.where((t) => t.type == 'received').length;
    });
    _startPolling();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    void poll() async {
      await ref.read(dashboardControllerProvider.notifier).refresh();
    }
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => poll());
  }

  @override
  void didUpdateWidget(covariant MerchantDashboard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_showQR && !_isPaid && _qrOpenReceivedCount != null) {
      final received = widget.transactions.where((t) => t.type == 'received').length;
      if (received > _qrOpenReceivedCount!) {
        final receivedList = widget.transactions.where((t) => t.type == 'received').toList();
      final newest = receivedList.isEmpty ? null : receivedList.first;
        if (newest != null) {
          final tolerance = (_numericAmount * 0.10).clamp(0.01, double.infinity);
          final amountOk = (newest.amount - _numericAmount).abs() <= tolerance ||
              _numericAmount == 0 ||
              newest.amount > 0;
          if (amountOk) {
            _pollTimer?.cancel();
            setState(() {
              _isPaid = true;
              _paidByPayTag = newest.payerPayTag ?? newest.counterparty;
              _paidAmount = newest.amount - newest.fee;
            });
            Future.delayed(const Duration(milliseconds: 2500), () {
              if (mounted) {
                setState(() {
                  _showQR = false;
                  _isPaid = false;
                  _paidByPayTag = null;
                  _paidAmount = 0;
                  _qrOpenReceivedCount = null;
                  _amount = '0';
                  _cart = [];
                });
                _pollTimer?.cancel();
              }
            });
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    final products = _products.isEmpty ? _defaultProducts : _products;
    final isKeypadDisabled = _cart.isNotEmpty;

    return Stack(
      children: [
        SingleChildScrollView(
          child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 12),
          // Quick Add
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Quick Add',
              style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: products.take(3).map((p) {
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: _QuickAddChip(
                      label: p.name,
                      amount: p.price.toStringAsFixed(2),
                      onTap: () => _handleQuickProduct(p),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          if (_cart.isNotEmpty) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: muted.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Cart', style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: fg)),
                        TextButton(
                          onPressed: _handleClear,
                          child: Text('Clear', style: GoogleFonts.dmSans(fontSize: 12, color: MonipayColors.destructive)),
                        ),
                      ],
                    ),
                    ..._cart.map((e) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${e.product.name} x${e.quantity}',
                                  style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                                ),
                              ),
                              Text(
                                '\$${(e.product.price * e.quantity).toStringAsFixed(2)}',
                                style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: fg),
                              ),
                              IconButton(
                                icon: const Icon(LucideIcons.x, size: 14),
                                onPressed: () => _handleRemoveFromCart(e.product.id),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                              ),
                            ],
                          ),
                        )),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          // Amount display
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: muted.withOpacity(0.3)),
              ),
              child: Column(
                children: [
                  Text(
                    'Amount to charge',
                    style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '\$${_numericAmount.toStringAsFixed(2)}',
                    style: GoogleFonts.dmSans(fontSize: 40, fontWeight: FontWeight.w700, color: fg),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'You receive: \$${_merchantReceives.toStringAsFixed(2)}',
                    style: GoogleFonts.dmSans(fontSize: 11, color: muted),
                  ),
                  Text(
                    'Platform fee (1%): \$${_fee.toStringAsFixed(2)}',
                    style: GoogleFonts.dmSans(fontSize: 11, color: muted),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Numpad 3x4: 1,2,3 / 4,5,6 / 7,8,9 / .,0,del
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Opacity(
              opacity: isKeypadDisabled ? 0.5 : 1,
              child: Column(
                children: [
                  Row(
                    children: ['1', '2', '3'].map((k) => _NumKey(k, onKey: _handleNumberClick, fg: fg, disabled: isKeypadDisabled)).toList(),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: ['4', '5', '6'].map((k) => _NumKey(k, onKey: _handleNumberClick, fg: fg, disabled: isKeypadDisabled)).toList(),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: ['7', '8', '9'].map((k) => _NumKey(k, onKey: _handleNumberClick, fg: fg, disabled: isKeypadDisabled)).toList(),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _NumKey('.', onKey: _handleNumberClick, fg: fg, disabled: isKeypadDisabled),
                      _NumKey('0', onKey: _handleNumberClick, fg: fg, disabled: isKeypadDisabled),
                      _NumKey('del', onKey: _handleNumberClick, fg: fg, isDel: true, disabled: isKeypadDisabled),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Clear + Charge
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                IconButton(
                  onPressed: _handleClear,
                  icon: const Icon(LucideIcons.x),
                  style: IconButton.styleFrom(foregroundColor: muted),
                ),
                Expanded(
                  child: Material(
                    color: _numericAmount >= 0.01 ? MonipayColors.primaryBlue : muted.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      onTap: _numericAmount >= 0.01 ? _openChargeQR : null,
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(LucideIcons.qrCode, color: Colors.white, size: 22),
                            const SizedBox(width: 10),
                            Text(
                              'Charge',
                              style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Recent Sales',
              style: GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w600, color: muted, letterSpacing: 1.2),
            ),
          ),
          const SizedBox(height: 8),
          if (_merchantTransactions.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text('No sales yet', style: GoogleFonts.dmSans(fontSize: 14, color: muted), textAlign: TextAlign.center),
            )
          else
            ..._merchantTransactions.take(10).map((tx) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                  child: _SaleRow(
                    transaction: tx,
                    fg: fg,
                    muted: muted,
                    onTap: () => _showReceipt(context, tx, dashboard.preferredNetwork),
                  ),
                )),
          const SizedBox(height: 120),
        ],
      ),
    ),
        if (_showQR) _buildChargeQRModal(),
      ],
    );
  }

  void _showReceipt(BuildContext context, DashboardTransaction tx, String preferredNetwork) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => TransactionReceiptModal(
        transaction: tx,
        preferredNetwork: preferredNetwork,
        onClose: () => Navigator.of(ctx).pop(),
      ),
    );
  }

  Widget _buildChargeQRModal() {
    if (!_showQR) return const SizedBox.shrink();
    final dashboard = ref.read(dashboardControllerProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final chainConfig = getChainConfig(dashboard.preferredNetwork);

    return Stack(
      children: [
        ModalBarrier(
          color: Colors.black54,
          onDismiss: () {
            if (!_isPaid) setState(() { _showQR = false; _qrOpenReceivedCount = null; });
            _pollTimer?.cancel();
          },
        ),
        Center(
          child: Material(
            color: theme.scaffoldBackgroundColor,
            borderRadius: BorderRadius.circular(24),
            child: Container(
              width: MediaQuery.of(context).size.width * 0.9,
              padding: const EdgeInsets.all(24),
              child: _isPaid
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: MonipayColors.primaryBlue.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: MonipayColors.primaryBlue),
                          ),
                          child: const Icon(LucideIcons.check, size: 48, color: MonipayColors.primaryBlue),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Payment Received!',
                          style: GoogleFonts.dmSans(fontSize: 20, fontWeight: FontWeight.w700, color: fg),
                        ),
                        if (_paidByPayTag != null) ...[
                          const SizedBox(height: 4),
                          Text('From @$_paidByPayTag', style: GoogleFonts.dmSans(fontSize: 14, color: muted)),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          '+\$${_paidAmount.toStringAsFixed(2)}',
                          style: GoogleFonts.dmSans(fontSize: 24, fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue),
                        ),
                      ],
                    )
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            IconButton(
                              icon: const Icon(LucideIcons.x),
                              onPressed: () {
                                setState(() { _showQR = false; _qrOpenReceivedCount = null; });
                                _pollTimer?.cancel();
                              },
                            ),
                          ],
                        ),
                        Text(
                          'Scan to Pay',
                          style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg),
                        ),
                        Text(
                          '\$${_numericAmount.toStringAsFixed(2)} ${chainConfig.currency}',
                          style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                        ),
                        const SizedBox(height: 12),
                        // Tabs: MoniPay / External Wallet
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _qrMode = 'monipay'),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: _qrMode == 'monipay' ? fg.withOpacity(0.08) : Colors.transparent,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text('MoniPay', textAlign: TextAlign.center, style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
                                ),
                              ),
                            ),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _qrMode = 'external'),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: _qrMode == 'external' ? fg.withOpacity(0.08) : Colors.transparent,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text('External Wallet', textAlign: TextAlign.center, style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: 180,
                          height: 180,
                          child: QrImageView(
                            data: _qrMode == 'monipay'
                                ? jsonEncode({
                                    'type': 'monipay',
                                    'payTag': dashboard.payTag ?? '',
                                    'address': dashboard.walletAddress ?? '',
                                    'merchantName': dashboard.payTag != null ? '@${dashboard.payTag}' : 'Merchant',
                                    'amount': _numericAmount,
                                    'fee': _fee,
                                    'merchantReceives': _merchantReceives,
                                    'items': _cart.map((e) => {'name': e.product.name, 'quantity': e.quantity, 'price': e.product.price}).toList(),
                                  })
                                : (dashboard.walletAddress ?? ''),
                            version: QrVersions.auto,
                            backgroundColor: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '\$${_numericAmount.toStringAsFixed(2)}',
                          style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w600, color: fg),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: MonipayColors.primaryBlue),
                            ),
                            const SizedBox(width: 8),
                            Text('Waiting for deposit...', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
                          ],
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

class _QuickAddChip extends StatelessWidget {
  const _QuickAddChip({required this.label, required this.amount, required this.onTap});

  final String label;
  final String amount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    const muted = MonipayColors.mutedSlate;

    return Material(
      color: cardBg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border.all(color: muted.withOpacity(0.3)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Text(label, style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: muted)),
              Text('\$$amount', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue)),
            ],
          ),
        ),
      ),
    );
  }
}

class _NumKey extends StatelessWidget {
  const _NumKey(
    this.keyLabel, {
    required this.onKey,
    required this.fg,
    this.isDel = false,
    this.disabled = false,
  });

  final String keyLabel;
  final void Function(String) onKey;
  final Color fg;
  final bool isDel;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Material(
        color: isDel ? MonipayColors.destructive.withOpacity(0.1) : cardBg,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: disabled ? null : () => onKey(keyLabel),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 52,
            alignment: Alignment.center,
            child: isDel
                ? Icon(LucideIcons.delete, size: 22, color: disabled ? fg.withOpacity(0.5) : MonipayColors.destructive)
                : Text(
                    keyLabel,
                    style: GoogleFonts.dmSans(fontSize: 22, fontWeight: FontWeight.w600, color: disabled ? fg.withOpacity(0.5) : fg),
                  ),
          ),
        ),
      ),
    );
  }
}

class _SaleRow extends StatelessWidget {
  const _SaleRow({
    required this.transaction,
    required this.fg,
    required this.muted,
    required this.onTap,
  });

  final DashboardTransaction transaction;
  final Color fg;
  final Color muted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final counterparty = transaction.counterparty.startsWith('0x')
        ? '${transaction.counterparty.substring(0, 6)}...${transaction.counterparty.substring(transaction.counterparty.length - 4)}'
        : (transaction.payerPayTag ?? transaction.counterparty);

    return Material(
      color: fg.withOpacity(0.06),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
          child: Row(
            children: [
              const Icon(LucideIcons.arrowDownLeft, size: 16, color: MonipayColors.success),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  counterparty,
                  style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w500, color: fg),
                ),
              ),
              Text(
                '+\$${(transaction.amount - transaction.fee).toStringAsFixed(2)}',
                style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: MonipayColors.success),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
