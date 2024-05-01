#!/usr/bin/env bash

if command sed --version > /dev/null 2>&1; then
  # GNU sed
  command find ./dev/esm -name "*.js" -exec sed -i -E "s#export (.*) from '\.(.*)';#export \1 from '.\2\.js';#g" {} +;
  command find ./dev/esm -name "*.js" -exec sed -i -E "s#import (.*) from '\.(.*)';#import \1 from '.\2\.js';#g" {} +;
else
  # BSD sed
  command find ./dev/esm -name "*.js" -exec sed -i '' -E "s#export (.*) from '\.(.*)';#export \1 from '.\2\.js';#g" {} +;
  command find ./dev/esm -name "*.js" -exec sed -i '' -E "s#import (.*) from '\.(.*)';#import \1 from '.\2\.js';#g" {} +;
fi
