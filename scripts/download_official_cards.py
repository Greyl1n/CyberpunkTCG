#!/usr/bin/env python3
"""
Convenience forwarding wrapper for scripts/scrapers/download_official_cards.py.
Allows both 'python scripts/download_official_cards.py' and direct imports.
"""

import sys
from pathlib import Path

scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

try:
    from scrapers.download_official_cards import (
        ROOT_DIR,
        DATA_DIR,
        ASSETS_DIR,
        CARDS_JSON,
        fetch_official_cards,
        download_image,
        main
    )
except ImportError:
    from scripts.scrapers.download_official_cards import (
        ROOT_DIR,
        DATA_DIR,
        ASSETS_DIR,
        CARDS_JSON,
        fetch_official_cards,
        download_image,
        main
    )

if __name__ == "__main__":
    main()
