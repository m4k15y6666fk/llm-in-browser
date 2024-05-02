#!/usr/bin/env bash

command mkdir dist;

#command cp -r dev/assets dist/;
command cp -r dev/esm dist/;
command cp -r dev/*.js dist/;
command cp -r dev/*.html dist/;

command cp _headers dist/;
