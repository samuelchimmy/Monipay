import 'dart:math' show min;

import 'package:flutter/material.dart';
import 'package:path_drawing/path_drawing.dart';

// M letterform path from MoniPay SVG (viewBox 178 224 1159 1056)
const String kMonipayMPath =
    'M 287.042969 1278.835938 C 272.902344 1278.835938 258.21875 1276.117188 244.625 1270.136719 C 189.15625 1246.761719 163.597656 1182.613281 186.980469 1127.710938 L 480.636719 436.773438 C 485.53125 425.902344 491.515625 415.570312 499.671875 406.875 L 502.390625 403.613281 C 526.863281 375.886719 563.839844 362.839844 600.277344 368.820312 C 636.710938 374.800781 667.710938 398.71875 682.9375 432.425781 L 826.503906 758.59375 L 1120.160156 276.40625 C 1137.5625 247.59375 1167.472656 228.566406 1201.1875 224.761719 C 1234.902344 220.957031 1268.078125 233.460938 1291.460938 257.378906 L 1298.53125 264.992188 C 1317.5625 285.105469 1328.441406 311.199219 1328.984375 338.921875 L 1334.421875 731.957031 C 1335.507812 791.753906 1287.109375 841.222656 1227.289062 842.3125 C 1167.472656 843.398438 1117.984375 795.015625 1116.898438 735.21875 L 1116.351562 699.882812 L 904.265625 1048.339844 C 883.058594 1083.132812 844.449219 1102.703125 804.207031 1099.984375 C 763.964844 1097.265625 728.074219 1072.261719 711.757812 1035.292969 L 584.507812 747.179688 L 386.558594 1212.511719 C 369.15625 1253.828125 328.914062 1278.835938 287.042969 1278.835938 Z';

const double _kViewBoxX = 178;
const double _kViewBoxY = 224;
const double _kViewBoxW = 1159;
const double _kViewBoxH = 1056;
const double _kDotCenterX = 1222;
const double _kDotCenterY = 1031;
const double _kDotRadius = 114;

/// Paints the MoniPay M letterform (stroke then fill) and dot.
class MonipayLogoPainter extends CustomPainter {
  MonipayLogoPainter({
    required this.pathLength,
    required this.showFill,
    required this.dotScale,
    required this.dotOpacity,
    required this.color,
  }) : _mPath = parseSvgPathData(kMonipayMPath);

  final double pathLength;
  final bool showFill;
  final double dotScale;
  final double dotOpacity;
  final Color color;
  final Path _mPath;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = min(size.width / _kViewBoxW, size.height / _kViewBoxH);
    final offsetX = (size.width - (_kViewBoxW * scale)) / 2;
    final offsetY = (size.height - (_kViewBoxH * scale)) / 2;

    canvas.save();
    canvas.translate(offsetX, offsetY);
    canvas.scale(scale);
    canvas.translate(-_kViewBoxX, -_kViewBoxY);

    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 60
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;

    final metrics = _mPath.computeMetrics();
    for (final metric in metrics) {
      final totalLength = metric.length;
      final trimLength = totalLength * pathLength.clamp(0.0, 1.0);
      if (trimLength > 0) {
        final segment = metric.extractPath(0.0, trimLength);
        canvas.drawPath(segment, paint);
      }
    }

    if (showFill) {
      paint
        ..style = PaintingStyle.fill
        ..strokeWidth = 0;
      canvas.drawPath(_mPath, paint);
    }

    if (dotOpacity > 0 && dotScale > 0) {
      final dotPaint = Paint()
        ..color = color.withOpacity(dotOpacity)
        ..style = PaintingStyle.fill
        ..isAntiAlias = true;
      canvas.save();
      canvas.translate(_kDotCenterX, _kDotCenterY);
      canvas.scale(dotScale);
      canvas.drawCircle(Offset.zero, _kDotRadius, dotPaint);
      canvas.restore();
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant MonipayLogoPainter oldDelegate) {
    return oldDelegate.pathLength != pathLength ||
        oldDelegate.showFill != showFill ||
        oldDelegate.dotScale != dotScale ||
        oldDelegate.dotOpacity != dotOpacity ||
        oldDelegate.color != color;
  }
}

/// MoniPay logo that plays stroke → fill → dot animation on load.
class AnimatedMonipayLogo extends StatefulWidget {
  const AnimatedMonipayLogo({
    super.key,
    required this.color,
    this.size = 104,
  });

  final Color color;
  final double size;

  @override
  State<AnimatedMonipayLogo> createState() => _AnimatedMonipayLogoState();
}

class _AnimatedMonipayLogoState extends State<AnimatedMonipayLogo>
    with SingleTickerProviderStateMixin {
  static const Duration _total = Duration(milliseconds: 4800);

  late final AnimationController _controller;
  late final Animation<double> _pathLength;
  late final Animation<double> _dotScale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: _total);
    _pathLength = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0, 3200 / 4800, curve: Curves.easeInOut),
      ),
    );
    _dotScale = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(3800 / 4800, 1, curve: Curves.elasticOut),
      ),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final pathT = _pathLength.value;
        final showFill = pathT >= 1.0;
        return CustomPaint(
          painter: MonipayLogoPainter(
            pathLength: pathT,
            showFill: showFill,
            dotScale: _dotScale.value,
            dotOpacity: 1,
            color: widget.color,
          ),
          size: Size(widget.size, widget.size),
        );
      },
    );
  }
}
