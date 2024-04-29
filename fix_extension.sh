#!/usr/bin/env bash

if sed --version > /dev/null 2>&1; then
  # GNU sed
  find ./dev/esm -name "*.js" -exec sed -i -E "s#export (.*) from '\.(.*)';#export \1 from '.\2\.js';#g" {} +;
  find ./dev/esm -name "*.js" -exec sed -i -E "s#import (.*) from '\.(.*)';#import \1 from '.\2\.js';#g" {} +;
else
  # BSD sed
  find ./dev/esm -name "*.js" -exec sed -i '' -E "s#export (.*) from '\.(.*)';#export \1 from '.\2\.js';#g" {} +;
  find ./dev/esm -name "*.js" -exec sed -i '' -E "s#import (.*) from '\.(.*)';#import \1 from '.\2\.js';#g" {} +;
fi
