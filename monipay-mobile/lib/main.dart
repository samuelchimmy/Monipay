import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/router/app_router.dart';
import 'app/theme/app_theme.dart';
import 'features/auth/presentation/theme_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Surface errors in browser console so we can see what fails
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    if (kDebugMode) debugPrint('FlutterError: ${details.exception}');
  };

  try {
    await _init();
    runApp(const ProviderScope(child: MonipayApp()));
  } catch (e, st) {
    if (kDebugMode) {
      debugPrint('main error: $e');
      debugPrint('$st');
    }
    runApp(_ErrorApp(message: e.toString()));
  }
}

Future<void> _init() async {
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    // On web the file isn't on disk; load from the asset bundle (pubspec includes .env).
    if (kIsWeb) {
      try {
        final s = await rootBundle.loadString('.env');
        for (final line in s.split('\n')) {
          final trimmed = line.trim();
          if (trimmed.isEmpty || trimmed.startsWith('#')) continue;
          final i = trimmed.indexOf('=');
          if (i > 0) {
            dotenv.env[trimmed.substring(0, i).trim()] = trimmed.substring(i + 1).trim();
          }
        }
      } catch (_) {}
    }
  }

  final supabaseUrl = dotenv.env['SUPABASE_URL'] ?? '';
  final supabaseAnonKey = dotenv.env['SUPABASE_ANON_KEY'] ?? '';

  if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
    throw Exception(
      'SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env. '
      'On web, .env is loaded from assets (see pubspec.yaml).',
    );
  }

  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
}

class MonipayApp extends ConsumerWidget {
  const MonipayApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    final themeMode = ref.watch(themeControllerProvider);

    return MaterialApp.router(
      title: 'Monipay',
      debugShowCheckedModeBanner: false,
      theme: MonipayTheme.light,
      darkTheme: MonipayTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}

/// Shown when main() or runApp fails so we see something on screen + in console
class _ErrorApp extends StatelessWidget {
  const _ErrorApp({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Monipay – startup error', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                SelectableText(message, style: const TextStyle(fontFamily: 'monospace')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}


