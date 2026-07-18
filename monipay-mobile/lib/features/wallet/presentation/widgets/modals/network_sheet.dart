import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

class NetworkSheet extends StatelessWidget {
  const NetworkSheet({
    super.key,
    required this.currentNetwork,
    required this.onClose,
    this.onSelectNetwork,
  });

  final String currentNetwork;
  final VoidCallback onClose;
  final ValueChanged<String>? onSelectNetwork;

  static const List<String> networks = ['Base', 'BSC', 'Solana'];

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null && details.primaryVelocity! > 400) {
          onClose();
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.35,
        minChildSize: 0.2,
        maxChildSize: 0.5,
        expand: false,
        builder: (context, scrollController) {
          return Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Theme.of(context).dividerColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Row(
                  children: [
                    Text(
                      'Network',
                      style: GoogleFonts.dmSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: onClose,
                      icon: const Icon(LucideIcons.x),
                    ),
                  ],
                ),
              ),
              ...networks.map(
                (net) {
                  final netLower = net.toLowerCase();
                  final isSelected = currentNetwork.toLowerCase() == netLower;
                  return ListTile(
                    title: Text(net, style: GoogleFonts.dmSans(fontWeight: FontWeight.w500)),
                    trailing: isSelected
                        ? const Icon(LucideIcons.check, size: 20)
                        : null,
                    onTap: () {
                      onSelectNetwork?.call(netLower);
                      onClose();
                    },
                  );
                },
              ),
            ],
          ),
        );
      },
    ),
    );
  }
}
