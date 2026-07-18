import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

class PaySheet extends StatelessWidget {
  const PaySheet({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null && details.primaryVelocity! > 400) {
          onClose();
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.4,
        minChildSize: 0.25,
        maxChildSize: 0.9,
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
                      'QR Scanner',
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
              Expanded(
                child: Center(
                  child: Text(
                    'QR Scanner Coming Soon',
                    style: GoogleFonts.dmSans(
                      fontSize: 16,
                      color: Theme.of(context).hintColor,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    ),
    );
  }
}
