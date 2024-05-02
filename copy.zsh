#!/usr/bin/env zsh

command mkdir dist;

#command cp -r dev/assets dist/;
command cp -r dev/esm dist/;
command cp -r dev/*.(js|html) dist/;
