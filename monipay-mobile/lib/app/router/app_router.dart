import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:monipay/features/auth/presentation/splash_screen.dart';
import 'package:monipay/features/auth/presentation/onboarding_screen.dart';
import 'package:monipay/features/auth/presentation/lock_screen.dart';
import 'package:monipay/features/auth/presentation/feature_tour_screen.dart';
import 'package:monipay/features/auth/presentation/login_page.dart';
import 'package:monipay/features/auth/presentation/register_page.dart';
import 'package:monipay/features/wallet/presentation/dashboard_screen.dart';
import 'package:monipay/features/wallet/presentation/settings_screen.dart';
import 'package:monipay/features/wallet/presentation/help_support_screen.dart';
import 'package:monipay/features/wallet/presentation/transaction_history_screen.dart';
import 'package:monipay/features/wallet/presentation/scan_screen.dart';
import 'package:monipay/features/transfer/presentation/send_page.dart';
import 'package:monipay/features/transfer/presentation/receive_page.dart';
import 'package:monipay/features/transactions/presentation/transactions_page.dart';

final routerProvider = Provider<GoRouter>(
  (ref) => GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (BuildContext context, GoRouterState state) =>
            const SplashScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        name: 'onboarding',
        builder: (BuildContext context, GoRouterState state) =>
            const OnboardingScreen(),
      ),
      GoRoute(
        path: '/feature-tour',
        name: 'feature-tour',
        builder: (BuildContext context, GoRouterState state) =>
            const FeatureTourScreen(),
      ),
      GoRoute(
        path: '/lock',
        name: 'lock',
        builder: (BuildContext context, GoRouterState state) =>
            const LockScreen(),
      ),
      GoRoute(
        path: '/',
        redirect: (_, __) => '/splash',
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (BuildContext context, GoRouterState state) =>
            const LoginPage(),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (BuildContext context, GoRouterState state) =>
            const RegisterPage(),
      ),
      GoRoute(
        path: '/dashboard',
        name: 'dashboard',
        builder: (BuildContext context, GoRouterState state) {
          final extra = state.extra;
          final openFund = extra is Map && extra['openFund'] == true;
          return DashboardScreen(openFundOnMount: openFund);
        },
      ),
      GoRoute(
        path: '/scan',
        name: 'scan',
        builder: (BuildContext context, GoRouterState state) =>
            const ScanScreen(),
      ),
      GoRoute(
        path: '/send',
        name: 'send',
        builder: (BuildContext context, GoRouterState state) =>
            const SendPage(),
      ),
      GoRoute(
        path: '/receive',
        name: 'receive',
        builder: (BuildContext context, GoRouterState state) =>
            const ReceivePage(),
      ),
      GoRoute(
        path: '/transactions',
        name: 'transactions',
        builder: (BuildContext context, GoRouterState state) =>
            const TransactionsPage(),
      ),
      GoRoute(
        path: '/settings',
        name: 'settings',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const SettingsScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1, 0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            );
          },
        ),
        routes: [
          GoRoute(
            path: 'help',
            name: 'help',
            builder: (context, state) => const HelpSupportScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/transaction-history',
        name: 'transaction-history',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const TransactionHistoryScreen(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(1, 0),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            );
          },
        ),
      ),
    ],
  ),
);

