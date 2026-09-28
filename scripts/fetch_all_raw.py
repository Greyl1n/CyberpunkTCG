#!/usr/bin/env python3
"""
Convenience forwarding wrapper for scripts/scrapers/fetch_all_raw.py.
"""

import sys
from pathlib import Path

scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

try:
    from scrapers.fetch_all_raw import fetch_all
except ImportError:
    from scripts.scrapers.fetch_all_raw import fetch_all

if __name__ == "__main__":
    fetch_all()
