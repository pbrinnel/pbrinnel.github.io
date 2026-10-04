#!/bin/bash
# Shortcut: runs _tools/life-local.command (serves your working copy, opens life.html).
# The leading underscore keeps it off the published site and at the top of the folder.
exec "$(dirname "$0")/_tools/life-local.command"
