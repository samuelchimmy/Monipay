import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:monipay/app/theme/app_theme.dart';
import '../../../../../core/config/chain_configs.dart';
import '../../../../../core/services/wallet_connect_service.dart';

/// Connected wallet deposit: connect external wallet, then send token to MoniPay address.
/// When WalletConnect is stubbed (no reown_appkit), connect shows a message.
class ConnectedWalletDepositView extends ConsumerStatefulWidget {
  const ConnectedWalletDepositView({
    super.key,
    required this.network,
    required this.onBack,
    required this.onSuccess,
  });

  final String network;
  final VoidCallback onBack;
  final void Function(double amount) onSuccess;

  @override
  ConsumerState<ConnectedWalletDepositView> createState() => _ConnectedWalletDepositViewState();
}

class _ConnectedWalletDepositViewState extends ConsumerState<ConnectedWalletDepositView> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _onConnectTap() async {
    final wc = ref.read(walletConnectServiceProvider);
    final address = await wc.connectWallet(context);
    if (!mounted) return;
    if (address == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'WalletConnect requires Dart 3.4+. Use Direct Deposit or upgrade SDK.',
          ),
        ),
      );
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
    final isConnected = wc.isConnected;
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
                onPressed: widget.onBack,
              ),
              Expanded(
                child: Text(
                  'Connected Wallet',
                  style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg),
                ),
              ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(LucideIcons.wallet, size: 18, color: accentColor),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        if (!isConnected) ...[
          Center(
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: muted.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(LucideIcons.wallet, size: 32, color: MonipayColors.mutedSlate),
                ),
                const SizedBox(height: 12),
                Text(
                  'Connect an external wallet to deposit ${config.currency}',
                  style: GoogleFonts.dmSans(fontSize: 14, color: muted),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _searchController,
              onChanged: (v) => setState(() => _searchQuery = v),
              decoration: InputDecoration(
                hintText: 'Search wallets...',
                prefixIcon: const Icon(LucideIcons.search, size: 20),
                filled: true,
                fillColor: theme.cardColor,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              style: GoogleFonts.dmSans(fontSize: 14, color: fg),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _WalletRow(
              name: 'MetaMask',
              onTap: _onConnectTap,
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _WalletRow(name: 'Rabby', onTap: _onConnectTap),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _WalletRow(name: 'Phantom', onTap: _onConnectTap),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              _searchQuery.isEmpty
                  ? 'Search to find more wallet options.'
                  : 'Temporary connection for depositing only.',
              style: GoogleFonts.dmSans(fontSize: 12, color: muted),
              textAlign: TextAlign.center,
            ),
          ),
        ] else ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: muted.withOpacity(0.2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: muted.withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: accentColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Icon(LucideIcons.wallet, color: accentColor),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              connectedAddress != null && connectedAddress.length > 10
                                  ? '${connectedAddress.substring(0, 6)}...${connectedAddress.substring(connectedAddress.length - 4)}'
                                  : connectedAddress ?? '',
                              style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg),
                            ),
                            Text(
                              '${config.name} · Source wallet',
                              style: GoogleFonts.dmSans(fontSize: 12, color: muted),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () => wc.disconnect(),
                        child: Text('Disconnect', style: GoogleFonts.dmSans(fontSize: 12, color: MonipayColors.destructive)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Amount input and Deposit button require WalletConnect (Dart 3.4+). Use Direct Deposit for now.',
              style: GoogleFonts.dmSans(fontSize: 12, color: muted),
            ),
          ),
        ],
      ],
    );
  }
}

class _WalletRow extends StatelessWidget {
  const _WalletRow({required this.name, required this.onTap});

  final String name;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Material(
      color: theme.cardColor,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: muted.withOpacity(0.3)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: MonipayColors.primaryBlue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w700, color: MonipayColors.primaryBlue),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  name,
                  style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w600, color: fg),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
