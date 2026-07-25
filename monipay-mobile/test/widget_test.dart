// Basic Flutter widget test for Monipay.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';

import 'package:monipay/app/theme/app_theme.dart';

void main() {
  testWidgets('App pumps without error', (WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/splash',
      routes: [
        GoRoute(
          path: '/splash',
          builder: (_, __) => const Scaffold(
            body: Center(child: Text('Splash')),
          ),
        ),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          theme: MonipayTheme.light,
          darkTheme: MonipayTheme.dark,
          routerConfig: router,
        ),
      ),
    );
    expect(find.text('Splash'), findsOneWidget);
  });
}
