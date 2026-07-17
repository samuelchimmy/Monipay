import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/security/secure_storage_service.dart';
import 'splash_screen.dart' show secureStorageServiceProvider;

const _kThemeKey = 'monipay_theme';

/// Persists theme preference (light/dark/system) to secure storage.
class ThemeController extends StateNotifier<ThemeMode> {
  ThemeController(this._storage) : super(ThemeMode.system) {
    _load();
  }

  final SecureStorageService _storage;

  Future<void> _load() async {
    final value = await _storage.read(key: _kThemeKey);
    if (value == 'dark') {
      state = ThemeMode.dark;
    } else if (value == 'light') {
      state = ThemeMode.light;
    }
  }

  Future<void> setTheme(ThemeMode mode) async {
    state = mode;
    final value = mode == ThemeMode.dark
        ? 'dark'
        : mode == ThemeMode.light
            ? 'light'
            : 'system';
    await _storage.write(key: _kThemeKey, value: value);
  }
}

final themeControllerProvider =
    StateNotifierProvider<ThemeController, ThemeMode>((ref) {
  final storage = ref.watch(secureStorageServiceProvider);
  return ThemeController(storage);
});
