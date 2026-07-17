import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_theme.dart';

class HelpSupportScreen extends StatelessWidget {
  const HelpSupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;

    return Scaffold(
      backgroundColor: isDark ? MonipayColors.backgroundDark : MonipayColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Help & Support',
          style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg),
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'For support email support@monipay.xyz',
                style: GoogleFonts.dmSans(fontSize: 16, color: fg),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              TextButton(
                onPressed: () => launchUrl(Uri.parse('https://monipay.xyz')),
                child: Text(
                  'Visit monipay.xyz',
                  style: GoogleFonts.dmSans(fontSize: 16, color: MonipayColors.primaryBlue),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
