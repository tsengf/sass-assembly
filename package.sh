#!/bin/sh

set -x
vsce package
set +x
echo "Package created"