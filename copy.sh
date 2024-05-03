#!/usr/bin/env bash

command mkdir dist;

command cp -u -r assets/* dist/;
command cp -u -r dev/* dist/;

command cp _headers dist/;
