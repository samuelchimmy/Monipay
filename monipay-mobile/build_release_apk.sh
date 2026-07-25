#!/bin/sh
# Release APK build with icon tree shaking disabled.
# Use this if you see: IconTreeShakerException: Font subsetting failed with exit code -9
exec flutter build apk --release --no-tree-shake-icons "$@"
