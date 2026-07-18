import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

/// Networks in exact order: Base, BSC, Solana.
const List<({String id, String label, Color color})> kNetworkToggleNetworks = [
  (id: 'celo', label: 'CELO', color: Color(0xFF35D07F)),
];

/// Reusable network toggle pill. Caller handles Supabase update on change.
class NetworkToggleWidget extends StatefulWidget {
  const NetworkToggleWidget({
    super.key,
    required this.currentNetwork,
    required this.onNetworkChanged,
  });

  final String currentNetwork;
  final void Function(String) onNetworkChanged;

  @override
  State<NetworkToggleWidget> createState() => _NetworkToggleWidgetState();
}

class _NetworkToggleWidgetState extends State<NetworkToggleWidget> {
  bool _expanded = false;
  int _staggerVisible = 0; // 0, 1, or 2 when expanded

  bool get isDark => Theme.of(context).brightness == Brightness.dark;

  Color get _pillBg =>
      isDark ? Colors.white.withOpacity(0.06) : Colors.black.withOpacity(0.06);

  Color get _borderColor => Colors.white12;

  ({String id, String label, Color color}) get _current {
    final net = widget.currentNetwork.toLowerCase();
    return kNetworkToggleNetworks.firstWhere(
      (n) => n.id == net,
      orElse: () => kNetworkToggleNetworks.first,
    );
  }

  List<({String id, String label, Color color})> get _otherNetworks =>
      kNetworkToggleNetworks.where((n) => n.id != _current.id).toList();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: _pillBg,
            border: Border.all(color: _borderColor),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Material(
            color: Colors.transparent,
            child: AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutBack,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  InkWell(
                    onTap: () {
                      final next = !_expanded;
                      setState(() {
                        _expanded = next;
                        if (!next) _staggerVisible = 0;
                      });
                      if (next && _otherNetworks.isNotEmpty) {
                        for (var i = 0; i < _otherNetworks.length; i++) {
                          Future.delayed(Duration(milliseconds: 35 * (i + 1)), () {
                            if (mounted && _expanded) {
                              setState(() => _staggerVisible = i + 1);
                            }
                          });
                        }
                      }
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 10,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: _current.color,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _current.label,
                            style: GoogleFonts.dmSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.12,
                              color: Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                          const SizedBox(width: 6),
                          AnimatedRotation(
                            turns: _expanded ? 0.5 : 0,
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                            child: Icon(
                              LucideIcons.chevronDown,
                              size: 14,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withOpacity(0.4),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_expanded) _buildExpandedOptions(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildExpandedOptions() {
    final muted = Theme.of(context).colorScheme.onSurface.withOpacity(0.5);
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 0, 6, 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(_otherNetworks.length, (i) {
          final n = _otherNetworks[i];
          final visible = _staggerVisible > i;
          return AnimatedOpacity(
            opacity: visible ? 1 : 0,
            duration: const Duration(milliseconds: 150),
            child: AnimatedSlide(
              offset: visible ? Offset.zero : const Offset(0, -0.2),
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutBack,
              child: InkWell(
                onTap: () {
                  setState(() => _expanded = false);
                  _staggerVisible = 0;
                  widget.onNetworkChanged(n.id);
                },
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(
                          color: n.color.withOpacity(0.5),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        n.label,
                        style: GoogleFonts.dmSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.10,
                          color: muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
