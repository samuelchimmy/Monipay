import 'package:flutter/material.dart';

class MonipayColors {
  MonipayColors._();

  static const Color primaryBlue = Color(0xFF0052FF);
  static const Color backgroundLight = Color(0xFFF5F7FA);
  static const Color backgroundDark = Color(0xFF0E0F14);
  static const Color foregroundLight = Color(0xFF131720);
  static const Color foregroundDark = Color(0xFFF0F4FC);
  static const Color cardLight = Color(0xFFFFFFFF);
  static const Color cardDark = Color(0xFF1A1A1F);
  static const Color success = Color(0xFF1A9E4A);
  static const Color destructive = Color(0xFFDC2626);
  static const Color warning = Color(0xFFF59E0B);
  static const Color mutedSlate = Color(0xFF64748B);
  static const Color balanceCardPersonal = Color(0xFF1A1F2E);
  static const Color balanceCardMerchant = Color(0xFF0052FF);
}

class MonipayTheme {
  MonipayTheme._();

  static ThemeData get light {
    final base = ThemeData.light();

    return base.copyWith(
      colorScheme: ColorScheme.fromSeed(
        seedColor: MonipayColors.primaryBlue,
        brightness: Brightness.light,
        primary: MonipayColors.primaryBlue,
        secondary: MonipayColors.mutedSlate,
        background: MonipayColors.backgroundLight,
      ),
      scaffoldBackgroundColor: MonipayColors.backgroundLight,
      cardColor: MonipayColors.cardLight,
      appBarTheme: const AppBarTheme(
        backgroundColor: MonipayColors.backgroundLight,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      textTheme: _textTheme(isDark: false),
      elevatedButtonTheme: _elevatedButtonTheme,
      outlinedButtonTheme: _outlinedButtonTheme,
      inputDecorationTheme: _inputDecorationTheme(isDark: false),
    );
  }

  static ThemeData get dark {
    final base = ThemeData.dark();

    return base.copyWith(
      colorScheme: ColorScheme.fromSeed(
        seedColor: MonipayColors.primaryBlue,
        brightness: Brightness.dark,
        primary: MonipayColors.primaryBlue,
        secondary: MonipayColors.mutedSlate,
        background: MonipayColors.backgroundDark,
      ),
      scaffoldBackgroundColor: MonipayColors.backgroundDark,
      cardColor: MonipayColors.cardDark,
      appBarTheme: const AppBarTheme(
        backgroundColor: MonipayColors.backgroundDark,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      textTheme: _textTheme(isDark: true),
      elevatedButtonTheme: _elevatedButtonTheme,
      outlinedButtonTheme: _outlinedButtonTheme,
      inputDecorationTheme: _inputDecorationTheme(isDark: true),
    );
  }

  static TextTheme _textTheme({required bool isDark}) {
    final base = isDark ? ThemeData.dark().textTheme : ThemeData.light().textTheme;
    final baseColor = isDark ? Colors.white : Colors.black;

    return base.copyWith(
      displayLarge: base.displayLarge?.copyWith(
        fontFamily: 'Montserrat',
        fontWeight: FontWeight.w700,
        color: baseColor,
      ),
      displayMedium: base.displayMedium?.copyWith(
        fontFamily: 'Montserrat',
        fontWeight: FontWeight.w700,
        color: baseColor,
      ),
      headlineMedium: base.headlineMedium?.copyWith(
        fontFamily: 'Montserrat',
        fontWeight: FontWeight.w600,
        color: baseColor,
      ),
      titleLarge: base.titleLarge?.copyWith(
        fontFamily: 'DM Sans',
        fontWeight: FontWeight.w600,
        color: baseColor,
      ),
      bodyLarge: base.bodyLarge?.copyWith(
        fontFamily: 'DM Sans',
        fontWeight: FontWeight.w400,
        color: baseColor,
      ),
      bodyMedium: base.bodyMedium?.copyWith(
        fontFamily: 'DM Sans',
        fontWeight: FontWeight.w400,
        color: baseColor,
      ),
      labelLarge: base.labelLarge?.copyWith(
        fontFamily: 'DM Sans',
        fontWeight: FontWeight.w500,
        color: baseColor,
      ),
    );
  }

  static ElevatedButtonThemeData get _elevatedButtonTheme {
    return ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  static OutlinedButtonThemeData get _outlinedButtonTheme {
    return OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  static InputDecorationTheme _inputDecorationTheme({required bool isDark}) {
    final borderColor = isDark ? MonipayColors.cardDark : MonipayColors.mutedSlate.withOpacity(0.4);

    OutlineInputBorder border(Color color) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: color),
        );

    return InputDecorationTheme(
      border: border(borderColor),
      enabledBorder: border(borderColor),
      focusedBorder: border(MonipayColors.primaryBlue),
      errorBorder: border(MonipayColors.destructive),
      filled: true,
      fillColor: isDark ? MonipayColors.cardDark : MonipayColors.cardLight,
    );
  }
}

