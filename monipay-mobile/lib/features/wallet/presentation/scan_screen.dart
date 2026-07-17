import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../app/theme/app_theme.dart';
import 'dashboard_controller.dart';
import 'send_controller.dart';

final scannedPaymentProvider = StateProvider<Map<String, dynamic>?>((ref) => null);

/// Full-screen QR scanner. Parses MoniPay JSON or 0x address, prefills SendSheet and opens it.
class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
    torchEnabled: false,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    final raw = barcodes.first.rawValue;
    if (raw == null || raw.isEmpty) return;

    _handled = true;

    // Try MoniPay JSON payload
    if (raw.trim().startsWith('{')) {
      try {
        final map = jsonDecode(raw) as Map<String, dynamic>?;
        // Handle both payment request and paytag receive QR payloads.
        if (map != null &&
            (map['type'] == 'monipay' || map['type'] == 'paytag_receive')) {
          final payTag = map['payTag'] as String?;
          final address = map['address'] as String?;
          final amount = map['amount'];
          final tag = payTag ?? address;
          if (map['type'] == 'monipay' &&
              (map['merchantAddress'] != null || map['address'] != null)) {
            ref.read(scannedPaymentProvider.notifier).state = map;
            if (mounted) {
              ref.read(dashboardControllerProvider.notifier).setOpenModal('pay_confirm');
              context.pop();
            }
            return;
          }

          if (tag != null && tag.toString().trim().isNotEmpty) {
            ref.read(sendControllerProvider.notifier).setRecipientMoniTag(tag.toString().trim());
            if (amount != null) {
              final a = amount is num ? amount.toDouble() : double.tryParse(amount.toString());
              if (a != null && a > 0) {
                ref.read(sendControllerProvider.notifier).setAmount(a.toString());
              }
            }
            if (mounted) {
              ref.read(dashboardControllerProvider.notifier).setOpenModal('send');
              context.pop();
            }
            return;
          }
        }
      } catch (_) {}
    }

    // Plain 0x address
    if (raw.trim().toLowerCase().startsWith('0x') &&
        RegExp(r'^0x[a-fA-F0-9]{40}$').hasMatch(raw.trim())) {
      ref.read(sendControllerProvider.notifier).setRecipientMoniTag(raw.trim());
      if (mounted) {
        ref.read(dashboardControllerProvider.notifier).setOpenModal('send');
        context.pop();
      }
      return;
    }

    _handled = false;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Unrecognized QR code')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // White brackets on dark camera background (always black bg), blue on light mode
    final bracketColor = isDark ? MonipayColors.primaryBlue : Colors.white;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Camera feed fills screen
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          // Dark vignette around the viewfinder to frame the scan area
          CustomPaint(
            painter: _VignettePainter(),
          ),
          // Back button — top-left, inside safe area
          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => context.pop(),
              ),
            ),
          ),
          // Viewfinder + label — perfectly centered in the remaining space
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ViewfinderOverlay(color: bracketColor),
                const SizedBox(height: 24),
                Text(
                  'Scan a MoniPay QR code',
                  style: GoogleFonts.dmSans(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                    shadows: [
                      const Shadow(color: Colors.black54, blurRadius: 8),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ViewfinderOverlay extends StatelessWidget {
  const _ViewfinderOverlay({required this.color});

  final Color color;

  static const double _size = 260;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _size,
      height: _size,
      child: CustomPaint(
        painter: _CornerBracketsPainter(color: color),
      ),
    );
  }
}

class _CornerBracketsPainter extends CustomPainter {
  _CornerBracketsPainter({required this.color});

  final Color color;

  static const double _stroke = 4;
  static const double _cornerLen = 36;
  static const double _radius = 4;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke
      ..strokeCap = StrokeCap.round;

    final w = size.width;
    final h = size.height;

    // Top-left
    canvas.drawLine(Offset(0, _cornerLen), const Offset(0, _radius), paint);
    canvas.drawLine(const Offset(_radius, 0), Offset(_cornerLen, 0), paint);
    // Top-right
    canvas.drawLine(Offset(w - _cornerLen, 0), Offset(w - _radius, 0), paint);
    canvas.drawLine(Offset(w, _radius), Offset(w, _cornerLen), paint);
    // Bottom-right
    canvas.drawLine(Offset(w, h - _cornerLen), Offset(w, h - _radius), paint);
    canvas.drawLine(Offset(w - _radius, h), Offset(w - _cornerLen, h), paint);
    // Bottom-left
    canvas.drawLine(Offset(_cornerLen, h), Offset(_radius, h), paint);
    canvas.drawLine(Offset(0, h - _radius), Offset(0, h - _cornerLen), paint);
  }

  @override
  bool shouldRepaint(covariant _CornerBracketsPainter old) => old.color != color;
}

/// Paints a dark transparent vignette with a clear 260×260 center cutout,
/// so the camera feed is visible through the viewfinder area.
class _VignettePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const cutoutSize = 260.0;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final rect = Rect.fromCenter(
      center: Offset(cx, cy),
      width: cutoutSize,
      height: cutoutSize,
    );

    // Full-screen dark overlay with a rounded-rect hole for the viewfinder
    final outerPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final innerPath = Path()
      ..addRRect(RRect.fromRectAndRadius(rect, const Radius.circular(12)));
    final combined = Path.combine(PathOperation.difference, outerPath, innerPath);

    canvas.drawPath(combined, Paint()..color = Colors.black.withOpacity(0.55));
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}
