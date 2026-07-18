import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:monipay/app/theme/app_theme.dart';

// Exact SVGs from _web_reference MoniBotSetupModal.tsx
const String _svgX = '''<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>''';
const String _svgDiscord = '''<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>''';
const String _svgTelegram = '''<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="m21.416 2.043-18.92 7.3c-1.764.68-1.756 1.692-.323 2.13l4.864 1.517 11.264-7.106c.531-.32.144-.067-.225.26l-9.103 8.216-.367 5.253c.536 0 .77-.245 1.069-.536l2.564-2.49 5.333 3.939c.983.542 1.69.263 1.933-.888l3.496-16.456c.355-1.425-.536-2.071-1.585-1.139z"/></svg>''';

class MonibotSheet extends StatefulWidget {
  const MonibotSheet({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  State<MonibotSheet> createState() => _MonibotSheetState();
}

class _MonibotSheetState extends State<MonibotSheet> {
  int _activePlatform = 0;

  static final List<_PlatformData> _platforms = [
    _PlatformData(
      name: 'Twitter / X',
      prefix: '@monibot',
      commands: [
        _Cmd(LucideIcons.send, 'Send Payment', '@monibot send \$5 to @alice'),
        _Cmd(LucideIcons.users, 'Multi-Send', '@monibot send \$2 each to @bob, @charlie'),
        _Cmd(LucideIcons.sparkles, 'Giveaway', '@monibot send \$1 to first 50 replies'),
        _Cmd(LucideIcons.clock, 'Scheduled', '@monibot send \$5 to @alice in 5mins'),
        _Cmd(LucideIcons.refreshCw, 'Balance', '@monibot balance'),
        _Cmd(LucideIcons.zap, 'Allowance', '@monibot allowance'),
      ],
    ),
    _PlatformData(
      name: 'Discord',
      prefix: '!monibot',
      commands: [
        _Cmd(LucideIcons.send, 'Send Payment', '!monibot send \$5 to @alice'),
        _Cmd(LucideIcons.users, 'Multi-Send', '!monibot send \$2 each to @bob, @charlie'),
        _Cmd(LucideIcons.sparkles, 'Giveaway', '!monibot send \$1 to first 50 replies'),
        _Cmd(LucideIcons.clock, 'Scheduled', '!monibot send \$5 to @alice in 5mins'),
        _Cmd(LucideIcons.refreshCw, 'Balance', '!monibot balance'),
        _Cmd(LucideIcons.zap, 'Allowance', '!monibot allowance'),
      ],
    ),
    _PlatformData(
      name: 'Telegram',
      prefix: '/monibot',
      commands: [
        _Cmd(LucideIcons.send, 'Send Payment', '/monibot send \$5 to @alice'),
        _Cmd(LucideIcons.users, 'Multi-Send', '/monibot send \$2 each to @bob, @charlie'),
        _Cmd(LucideIcons.sparkles, 'Giveaway', '/monibot send \$1 to first 50 replies'),
        _Cmd(LucideIcons.clock, 'Scheduled', '/monibot send \$5 to @alice in 5mins'),
        _Cmd(LucideIcons.refreshCw, 'Balance', '/monibot balance'),
        _Cmd(LucideIcons.zap, 'Allowance', '/monibot allowance'),
      ],
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;
    final cardBg = isDark ? MonipayColors.cardDark : MonipayColors.cardLight;
    final current = _platforms[_activePlatform];

    return GestureDetector(
      onVerticalDragEnd: (details) {
        if (details.primaryVelocity != null && details.primaryVelocity! > 400) {
          widget.onClose();
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        snap: true,
        snapSizes: const [0.75, 0.95],
        expand: false,
        builder: (context, scrollController) {
          return Container(
            decoration: BoxDecoration(
              color: theme.scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                const SizedBox(height: 12),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: theme.dividerColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                  child: Row(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: MonipayColors.primaryBlue,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: MonipayColors.primaryBlue.withOpacity(0.3),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: const Icon(LucideIcons.bot, size: 28, color: Colors.white),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'MoniBot AI',
                              style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: fg),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'AUTONOMOUS AGENT',
                              style: GoogleFonts.dmSans(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: muted,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: widget.onClose,
                        icon: const Icon(LucideIcons.x),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    children: [
                      _StepCard(
                        step: 1,
                        title: 'Link accounts',
                        icon: LucideIcons.link,
                        active: true,
                        showChevron: true,
                        onTap: () {
                          widget.onClose();
                          // Caller can open settings for link accounts
                        },
                      ),
                      const SizedBox(height: 8),
                      _StepCard(
                        step: 2,
                        title: 'Set allowance',
                        icon: LucideIcons.wallet,
                        active: false,
                        showChevron: false,
                      ),
                      const SizedBox(height: 8),
                      _StepCard(
                        step: 3,
                        title: 'Mention monibot in commands',
                        icon: LucideIcons.atSign,
                        active: false,
                        showChevron: false,
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'AVAILABLE COMMANDS',
                        style: GoogleFonts.dmSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: muted,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(3, (i) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: _PlatformIconButton(
                              index: i,
                              isActive: _activePlatform == i,
                              onTap: () => setState(() => _activePlatform = i),
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: cardBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: muted.withOpacity(0.2)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                _PlatformIcon(index: _activePlatform, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  current.name,
                                  style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w800, color: fg),
                                ),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: muted.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    current.prefix,
                                    style: GoogleFonts.dmSans(fontSize: 10, fontWeight: FontWeight.w700, color: fg).copyWith(fontFamily: 'monospace'),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            ...current.commands.map((c) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 28,
                                        height: 28,
                                        decoration: BoxDecoration(
                                          color: MonipayColors.primaryBlue.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Icon(c.icon, size: 14, color: MonipayColors.primaryBlue),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              c.label,
                                              style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w700, color: fg),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              c.cmd,
                                              style: GoogleFonts.dmSans(fontSize: 10, color: muted).copyWith(fontFamily: 'monospace'),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                )),
                          ],
                        ),
                      ),
                    ],
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

class _Cmd {
  const _Cmd(this.icon, this.label, this.cmd);
  final IconData icon;
  final String label;
  final String cmd;
}

class _PlatformData {
  const _PlatformData({required this.name, required this.prefix, required this.commands});
  final String name;
  final String prefix;
  final List<_Cmd> commands;
}

class _StepCard extends StatelessWidget {
  const _StepCard({
    required this.step,
    required this.title,
    required this.icon,
    required this.active,
    required this.showChevron,
    this.onTap,
  });

  final int step;
  final String title;
  final IconData icon;
  final bool active;
  final bool showChevron;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fg = isDark ? MonipayColors.foregroundDark : MonipayColors.foregroundLight;
    const muted = MonipayColors.mutedSlate;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: active ? MonipayColors.primaryBlue.withOpacity(0.05) : muted.withOpacity(0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: active ? MonipayColors.primaryBlue.withOpacity(0.2) : muted.withOpacity(0.2),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: active ? MonipayColors.primaryBlue : muted.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 14, color: active ? Colors.white : muted),
              ),
              const SizedBox(width: 12),
              Text(
                '$step. $title',
                style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w700, color: fg),
              ),
              const Spacer(),
              if (showChevron) Icon(LucideIcons.chevronRight, size: 18, color: active ? MonipayColors.primaryBlue : muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlatformIconButton extends StatelessWidget {
  const _PlatformIconButton({required this.index, required this.isActive, required this.onTap});

  final int index;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = index == 0 ? Colors.black : (index == 1 ? const Color(0xFF5865F2) : const Color(0xFF229ED9));
    return Material(
      color: isActive ? Theme.of(context).cardColor : color.withOpacity(0.15),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          child: _PlatformIcon(index: index, size: 22),
        ),
      ),
    );
  }
}

class _PlatformIcon extends StatelessWidget {
  const _PlatformIcon({required this.index, this.size = 22});

  final int index;
  final double size;

  @override
  Widget build(BuildContext context) {
    final Color color = index == 0 ? Colors.black : (index == 1 ? const Color(0xFF5865F2) : const Color(0xFF229ED9));
    final String svg = index == 0 ? _svgX : (index == 1 ? _svgDiscord : _svgTelegram);
    return SizedBox(
      width: size,
      height: size,
      child: SvgPicture.string(
        svg,
        color: color,
        colorBlendMode: BlendMode.srcIn,
        fit: BoxFit.contain,
      ),
    );
  }
}
