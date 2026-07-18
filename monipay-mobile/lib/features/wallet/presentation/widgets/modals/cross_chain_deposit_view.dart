import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../../../../core/config/chain_configs.dart';
import '../../../../../core/services/wallet_connect_service.dart';
import '../../dashboard_controller.dart';
import 'cross_chain_deposit_constants.dart';

typedef BridgeStep = String; // 'select' | 'connect-wallet' | 'review' | 'executing' | 'success' | 'error'
typedef ExecutionPhase = String; // 'authorizing' | 'bridging' | 'confirming'

class CrossChainDepositView extends ConsumerStatefulWidget {
  const CrossChainDepositView({
    super.key,
    required this.network,
    required this.onBack,
    required this.onSuccess,
  });

  final String network;
  final VoidCallback onBack;
  final void Function(double amount) onSuccess;

  @override
  ConsumerState<CrossChainDepositView> createState() => _CrossChainDepositViewState();
}

class _CrossChainDepositViewState extends ConsumerState<CrossChainDepositView> {
  BridgeStep _step = 'select';
  ExecutionPhase _executionPhase = 'authorizing';
  String _sourceChain = 'ETHEREUM';
  String _sourceToken = 'USDC';
  final _amountController = TextEditingController();
  Map<String, dynamic>? _acrossQuote;
  double? _feeUsd;
  String? _amountToReceive;
  int _estimatedTime = 15;
  String _error = '';
  bool _isLoadingQuote = false;
  String? _txHash;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  List<String> get _availableTokens {
    final m = tokensByChain[_sourceChain];
    if (m == null) return [];
    return m.keys.toList();
  }

  void _onChainChange(String newChain) {
    setState(() {
      _sourceChain = newChain;
      final tokens = _availableTokens;
      _sourceToken = tokens.contains('USDC')
          ? 'USDC'
          : tokens.contains('USDT')
              ? 'USDT'
              : tokens.isNotEmpty
                  ? tokens.first
                  : _sourceToken;
    });
  }

  bool get _canGetQuote {
    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) return false;
    if (!ref.read(walletConnectServiceProvider).isConnected) return false;
    return tokensByChain[_sourceChain]?[_sourceToken] != null;
  }

  Future<void> _getQuote() async {
    if (!_canGetQuote) return;
    final tokenInfo = tokensByChain[_sourceChain]?[_sourceToken];
    final externalAddress = ref.read(walletConnectServiceProvider).connectedAddress;
    if (tokenInfo == null || externalAddress == null) return;

    setState(() {
      _isLoadingQuote = true;
      _error = '';
    });

    try {
      final amountStr = _amountController.text;
      final amountWei = _parseUnits(amountStr, tokenInfo.decimals);
      final originChain = sourceChains.firstWhere((c) => c.id == _sourceChain);
      final destConfig = getChainConfig(widget.network);

      final q = {
        'tradeType': 'exactInput',
        'inputToken': tokenInfo.address,
        'outputToken': destConfig.token,
        'originChainId': '${originChain.chainId}',
        'destinationChainId': '${destConfig.id}',
        'amount': amountWei.toString(),
        'depositor': externalAddress,
        'recipient': ref.read(dashboardControllerProvider).walletAddress ?? '',
        'slippage': 'auto',
      };
      final queryStr = q.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
      final getRes = await Dio().get<Map<String, dynamic>>('$acrossApi/swap/approval?$queryStr');

      final data = getRes.data;
      if (data == null) throw Exception('No quote data');

      final expectedOutputRaw = data['expectedOutput'];
      final outputDecimals = destConfig.decimals;
      final expectedOutput = expectedOutputRaw != null
          ? (BigInt.tryParse(expectedOutputRaw.toString()) ?? BigInt.zero).toDouble() / pow10(outputDecimals)
          : double.tryParse(amountStr) ?? 0;

      final inputValue = double.tryParse(amountStr) ?? 0;
      final isSameAsset = _sourceToken == destConfig.currency ||
          (_sourceToken == 'USDC' && destConfig.currency == 'USDC') ||
          (_sourceToken == 'USDT' && destConfig.currency == 'USDT');
      final feeEstimate = isSameAsset ? (inputValue - expectedOutput).clamp(0.0, double.infinity) : 0.0;
      final isL2toL2 = originChain.chainId != 1 && destConfig.id != 1;
      final estimatedTime = data['estimatedFillTimeSec'] is int
          ? data['estimatedFillTimeSec'] as int
          : (isL2toL2 ? 5 : 15);

      if (!mounted) return;
      setState(() {
        _acrossQuote = data;
        _feeUsd = feeEstimate;
        _amountToReceive = expectedOutput.toStringAsFixed(outputDecimals > 8 ? 6 : 2);
        _estimatedTime = estimatedTime;
        _isLoadingQuote = false;
        _step = 'review';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst(RegExp(r'^Exception:?\s*'), '');
        _isLoadingQuote = false;
        _step = 'error';
      });
    }
  }

  static double pow10(int d) {
    double r = 1;
    for (int i = 0; i < d; i++) {
      r *= 10;
    }
    return r;
  }

  static BigInt _parseUnits(String amountStr, int decimals) {
    final parts = amountStr.split('.');
    final intPart = BigInt.tryParse(parts[0].replaceAll(RegExp(r'[^0-9-]'), '')) ?? BigInt.zero;
    final fracStr = parts.length > 1 ? parts[1].padRight(decimals, '0').substring(0, decimals.clamp(0, 30)) : ''.padLeft(decimals, '0');
    final fracBig = BigInt.tryParse(fracStr) ?? BigInt.zero;
    return intPart * BigInt.from(10).pow(decimals) + fracBig;
  }

  Future<void> _executeBridge() async {
    final quote = _acrossQuote;
    final wc = ref.read(walletConnectServiceProvider);
    if (quote == null || !wc.isConnected) return;

    setState(() {
      _step = 'executing';
      _executionPhase = 'authorizing';
      _error = '';
    });

    try {
      final originChain = sourceChains.firstWhere((c) => c.id == _sourceChain);

      await wc.switchChain(originChain.chainId);
      final approvalTxns = quote['approvalTxns'] as List<dynamic>?;
      if (approvalTxns != null && approvalTxns.isNotEmpty) {
        for (final tx in approvalTxns) {
          final t = tx as Map<String, dynamic>;
          await wc.sendTransaction(
            to: t['to'] as String,
            data: t['data'] as String,
            value: BigInt.zero,
            chainId: originChain.chainId,
          );
        }
      }

      if (!mounted) return;
      setState(() => _executionPhase = 'bridging');

      final swapTx = quote['swapTx'] as Map<String, dynamic>?;
      if (swapTx != null) {
        final hash = await wc.sendTransaction(
          to: swapTx['to'] as String,
          data: swapTx['data'] as String,
          value: BigInt.tryParse(swapTx['value']?.toString() ?? '0') ?? BigInt.zero,
          chainId: originChain.chainId,
        );
        _txHash = hash;

        if (!mounted) return;
        setState(() => _executionPhase = 'confirming');

        for (int i = 0; i < 60; i++) {
          await Future.delayed(const Duration(seconds: 2));
          try {
            final statusRes = await Dio().get<Map<String, dynamic>>(
              '$acrossApi/deposit/status',
              queryParameters: {
                'depositTxHash': hash,
                'originChainId': originChain.chainId,
              },
            );
            final statusData = statusRes.data;
            if (statusData != null && statusData['status'] == 'filled') {
              if (statusData['fillTxHash'] != null) _txHash = statusData['fillTxHash'] as String;
              if (!mounted) return;
              setState(() => _step = 'success');
              final amount = double.tryParse(_amountController.text) ?? 0;
              Future.delayed(const Duration(seconds: 2), () => widget.onSuccess(amount));
              return;
            }
            if (statusData != null && statusData['status'] == 'expired') {
              throw Exception('Bridge deposit expired');
            }
          } catch (_) {
            // Ignore transient polling errors
          }
        }
      }

      setState(() => _step = 'success');
      final amount = double.tryParse(_amountController.text) ?? 0;
      Future.delayed(const Duration(seconds: 2), () => widget.onSuccess(amount));
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().replaceFirst(RegExp(r'^Exception:?\s*'), '');
      setState(() {
        _error = msg.contains('rejected') || msg.contains('denied') ? 'Transaction rejected by wallet' : msg;
        _step = 'error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final config = getChainConfig(widget.network);
    final isBase = widget.network.toLowerCase() == 'base';
    final accentColor = isBase ? const Color(0xFF0052FF) : const Color(0xFFFFB800);
    final wc = ref.watch(walletConnectServiceProvider);
    final connectedAddress = wc.connectedAddress;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(LucideIcons.arrowLeft),
                onPressed: _step == 'executing'
                    ? null
                    : (_step == 'select' || _step == 'connect-wallet'
                        ? widget.onBack
                        : () => setState(() => _step = 'select')),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Cross-Chain Deposit',
                      style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w600, color: fg),
                    ),
                    Text(
                      'Powered by Across Protocol · ${sourceChains.length} networks',
                      style: GoogleFonts.dmSans(fontSize: 10, color: muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _step == 'select'
                ? _buildSelect(theme, fg, muted, accentColor, config, connectedAddress)
                : _step == 'connect-wallet'
                    ? _buildConnectWallet(theme, fg, muted)
                    : _step == 'review'
                        ? _buildReview(theme, fg, muted, accentColor, config)
                        : _step == 'executing'
                            ? _buildExecuting(theme, fg, muted, accentColor)
                            : _step == 'success'
                                ? _buildSuccess(theme, fg, muted, accentColor, config)
                                : _buildError(theme, fg, muted),
          ),
        ),
      ],
    );
  }

  Widget _buildSelect(
    ThemeData theme,
    Color fg,
    Color muted,
    Color accentColor,
    ChainConfig config,
    String? connectedAddress,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: muted.withOpacity(0.2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: muted.withOpacity(0.3)),
          ),
          child: connectedAddress != null
              ? Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: accentColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(LucideIcons.wallet, size: 16, color: accentColor),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${connectedAddress.substring(0, 6)}...${connectedAddress.substring(connectedAddress.length - 4)}',
                            style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg),
                          ),
                          Text('Connected · Source wallet', style: GoogleFonts.dmSans(fontSize: 10, color: muted)),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => ref.read(walletConnectServiceProvider).disconnect(),
                      child: Text('Disconnect', style: GoogleFonts.dmSans(fontSize: 12, color: MonipayColors.destructive)),
                    ),
                  ],
                )
              : InkWell(
                  onTap: () async {
                    final addr = await ref.read(walletConnectServiceProvider).connectWallet(context);
                    if (mounted && addr == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('WalletConnect requires Dart 3.4+. Use Direct Deposit or upgrade SDK.')),
                      );
                    }
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(color: muted.withOpacity(0.3), borderRadius: BorderRadius.circular(16)),
                          child: Icon(LucideIcons.wallet, size: 16, color: muted),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Connect External Wallet', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg)),
                              Text('MetaMask, Rabby, Phantom…', style: GoogleFonts.dmSans(fontSize: 10, color: muted)),
                            ],
                          ),
                        ),
                        Icon(LucideIcons.arrowLeft, size: 16, color: muted),
                      ],
                    ),
                  ),
                ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: muted.withOpacity(0.2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: muted.withOpacity(0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('BRIDGE FROM', style: GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w600, color: muted)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _sourceChain,
                        isExpanded: true,
                        items: sourceChains.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                        onChanged: (v) => v != null ? _onChainChange(v) : null,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _availableTokens.contains(_sourceToken) ? _sourceToken : (_availableTokens.isNotEmpty ? _availableTokens.first : null),
                        isExpanded: true,
                        items: _availableTokens.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                        onChanged: (v) => v != null ? setState(() => _sourceToken = v) : null,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _amountController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            hintText: '0.00',
            filled: true,
            fillColor: theme.cardColor,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
          style: GoogleFonts.dmSans(fontSize: 22, fontWeight: FontWeight.w700),
          textAlign: TextAlign.center,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: accentColor.withOpacity(0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: accentColor.withOpacity(0.15)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('TO · LOCKED', style: GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w600, color: muted)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(color: accentColor.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                    child: Center(
                      child: Text(
                        config.name[0],
                        style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w800, color: accentColor),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${config.currency} on ${config.name}', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg)),
                      Text('@${ref.read(dashboardControllerProvider).payTag ?? "you"}', style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w500, color: accentColor)),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: (_canGetQuote && !_isLoadingQuote) ? _getQuote : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: accentColor,
              foregroundColor: widget.network.toLowerCase() == 'base' ? Colors.white : Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _isLoadingQuote
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70)),
                      const SizedBox(width: 8),
                      Text('Fetching Quote...', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700)),
                    ],
                  )
                : Text('Get Quote', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700)),
          ),
        ),
        if (!ref.read(walletConnectServiceProvider).isConnected)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              'Connect an external wallet above to continue.',
              style: GoogleFonts.dmSans(fontSize: 10, color: muted),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }

  Widget _buildConnectWallet(ThemeData theme, Color fg, Color muted) {
    return Column(
      children: [
        const Icon(LucideIcons.wallet, size: 56),
        const SizedBox(height: 12),
        Text('Connect a wallet to bridge from', style: GoogleFonts.dmSans(fontSize: 14, color: muted)),
      ],
    );
  }

  Widget _buildReview(ThemeData theme, Color fg, Color muted, Color accentColor, ChainConfig config) {
    final amount = _amountController.text;
    final originChain = sourceChains.firstWhere((c) => c.id == _sourceChain);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: accentColor.withOpacity(0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: accentColor.withOpacity(0.15)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Bridge Summary', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: fg)),
              const SizedBox(height: 12),
              _reviewRow('Send', '$amount $_sourceToken', fg, muted),
              _reviewRow('From', originChain.name, fg, muted),
              if (_feeUsd != null && _feeUsd! > 0) _reviewRow('Bridge Fee', '\$${_feeUsd!.toStringAsFixed(2)}', fg, muted),
              _reviewRow('You Receive', '~$_amountToReceive ${config.currency}', accentColor, muted),
              _reviewRow('Est. Time', '~${_estimatedTime}s ⚡', MonipayColors.success, muted),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _executeBridge,
          style: ElevatedButton.styleFrom(
            backgroundColor: accentColor,
            foregroundColor: widget.network.toLowerCase() == 'base' ? Colors.white : Colors.black,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: Text('Bridge Now', style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => setState(() {
            _step = 'select';
            _acrossQuote = null;
            _amountToReceive = null;
            _feeUsd = null;
          }),
          child: Text('← Edit Details', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
        ),
      ],
    );
  }

  Widget _reviewRow(String label, String value, Color valueColor, Color muted) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.dmSans(fontSize: 13, color: muted)),
          Text(value, style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: valueColor)),
        ],
      ),
    );
  }

  Widget _buildExecuting(ThemeData theme, Color fg, Color muted, Color accentColor) {
    const phaseKeys = ['authorizing', 'bridging', 'confirming'];
    final phaseLabels = ['Approving', 'Bridging Assets', 'Confirming'];
    final icons = [LucideIcons.wallet, LucideIcons.arrowLeftRight, LucideIcons.zap];
    final idx = phaseKeys.indexOf(_executionPhase).clamp(0, 2);

    return Column(
      children: [
        for (int i = 0; i < 3; i++) ...[
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: i < idx ? MonipayColors.success : (i == idx ? accentColor : muted.withOpacity(0.3)),
                  shape: BoxShape.circle,
                ),
                child: i < idx
                    ? const Icon(LucideIcons.check, size: 18, color: Colors.white)
                    : i == idx
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Icon(icons[i], size: 18, color: muted),
              ),
              const SizedBox(width: 12),
              Text(phaseLabels[i], style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w500, color: i <= idx ? fg : muted)),
            ],
          ),
          const SizedBox(height: 12),
        ],
        const SizedBox(height: 24),
        Text(
          'Do not close this screen. Bridge in progress via Across Protocol.',
          style: GoogleFonts.dmSans(fontSize: 11, color: muted),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildSuccess(ThemeData theme, Color fg, Color muted, Color accentColor, ChainConfig config) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(color: MonipayColors.success, borderRadius: BorderRadius.circular(16)),
          child: const Icon(LucideIcons.checkCircle, size: 32, color: Colors.white),
        ),
        const SizedBox(height: 16),
        Text('Bridge Complete!', style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg)),
        const SizedBox(height: 8),
        Text(
          '+${_amountController.text} ${config.currency}',
          style: GoogleFonts.dmSans(fontSize: 22, fontWeight: FontWeight.w700, color: accentColor),
        ),
        const SizedBox(height: 8),
        Text('Funds have been bridged to your MoniPay wallet.', style: GoogleFonts.dmSans(fontSize: 12, color: muted)),
        if (_txHash != null) ...[
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: () => launchUrl(Uri.parse('${config.explorerUrl}/tx/$_txHash')),
            icon: const Icon(LucideIcons.externalLink, size: 14),
            label: const Text('View on Explorer'),
          ),
        ],
      ],
    );
  }

  Widget _buildError(ThemeData theme, Color fg, Color muted) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: MonipayColors.destructive.withOpacity(0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: MonipayColors.destructive.withOpacity(0.2)),
          ),
          child: const Icon(LucideIcons.alertCircle, size: 32, color: MonipayColors.destructive),
        ),
        const SizedBox(height: 16),
        Text('Bridge Failed', style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg)),
        const SizedBox(height: 8),
        Text(_error, style: GoogleFonts.dmSans(fontSize: 13, color: muted), textAlign: TextAlign.center),
        const SizedBox(height: 20),
        OutlinedButton(
          onPressed: () => setState(() {
            _step = 'select';
            _error = '';
            _acrossQuote = null;
            _amountToReceive = null;
            _feeUsd = null;
          }),
          child: const Text('Try Again'),
        ),
      ],
    );
  }
}
