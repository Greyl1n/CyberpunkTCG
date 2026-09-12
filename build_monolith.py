#!/usr/bin/env python3
"""
Cyberpunk TCG - Monolith HTML Compiler (WeirdCo Edition)
Compiles modular HTML, CSS, JavaScript, 151 official card datasets, and starter decks
into a single zero-dependency standalone HTML file: dist/cyberpunk_tcg_monolith.html.
"""

import os
import re
import json
from pathlib import Path

def build_monolith():
    root_dir = Path(__file__).resolve().parent
    src_dir = root_dir / "src"
    data_dir = root_dir / "data"
    dist_dir = root_dir / "dist"
    
    dist_dir.mkdir(exist_ok=True)
    out_file = dist_dir / "cyberpunk_tcg_monolith.html"
    
    print("=" * 60)
    print("WEIRDCO CYBERPUNK TCG // COMPILING MONOLITH HTML BUNDLE")
    print("=" * 60)
    
    # 1. Load data
    cards_path = data_dir / "cards.json"
    starters_path = data_dir / "starter_decks.json"
    
    if not cards_path.exists():
        raise FileNotFoundError(f"Missing {cards_path}")
    if not starters_path.exists():
        raise FileNotFoundError(f"Missing {starters_path}")
        
    with open(cards_path, "r", encoding="utf-8") as f:
        cards_data = json.load(f)
    with open(starters_path, "r", encoding="utf-8") as f:
        starters_data = json.load(f)
        
    print(f"[*] Loaded {len(cards_data)} official cards from {cards_path.name}")
    print(f"[*] Loaded {len(starters_data)} starter decks from {starters_path.name}")
    
    # 2. Read template HTML
    index_html_path = src_dir / "index.html"
    if not index_html_path.exists():
        raise FileNotFoundError(f"Missing {index_html_path}")
        
    with open(index_html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    # 3. Inline CSS files
    css_pattern = re.compile(r'<link\s+rel="stylesheet"\s+href="([^"]+)">', re.IGNORECASE)
    
    def replace_css(match):
        rel_href = match.group(1)
        css_file_path = src_dir / rel_href
        if not css_file_path.exists():
            css_file_path = src_dir / "css" / Path(rel_href).name
        if css_file_path.exists():
            with open(css_file_path, "r", encoding="utf-8") as cf:
                css_content = cf.read()
            print(f"  [+] Inlined CSS: {rel_href} ({len(css_content)} bytes)")
            return f"<style>\n/* Inlined from {rel_href} */\n{css_content}\n</style>"
        else:
            print(f"  [!] Warning: CSS file not found: {css_file_path}")
            return match.group(0)
            
    html_content = css_pattern.sub(replace_css, html_content)
    
    # 4. Inject Embedded Datasets into HTML
    embedded_data_script = f"""
  <script>
    /* Embedded Master Card Repository and Starter Decks */
    window.__CYBERPUNK_CARDS__ = {json.dumps(cards_data, indent=2)};
    window.__CYBERPUNK_STARTER_DECKS__ = {json.dumps(starters_data, indent=2)};
  </script>
"""
    # Insert safely before first script tag using find & splice (avoids regex backslash escape issues)
    first_script_pos = html_content.find('<script')
    if first_script_pos != -1:
        html_content = html_content[:first_script_pos] + embedded_data_script + '\n  ' + html_content[first_script_pos:]
    else:
        html_content = html_content.replace('</head>', f"{embedded_data_script}\n</head>")
        
    # 5. Inline JavaScript files
    script_pattern = re.compile(r'<script\s+src="([^"]+)"></script>', re.IGNORECASE)
    
    def replace_js(match):
        rel_src = match.group(1)
        js_file_path = src_dir / rel_src
        if not js_file_path.exists():
            js_file_path = src_dir / "js" / Path(rel_src).name
        if js_file_path.exists():
            with open(js_file_path, "r", encoding="utf-8") as jf:
                js_content = jf.read()
            print(f"  [+] Inlined JS:  {rel_src} ({len(js_content)} bytes)")
            return f"<script>\n/* Inlined from {rel_src} */\n{js_content}\n</script>"
        else:
            print(f"  [!] Warning: JS file not found: {js_file_path}")
            return match.group(0)
            
    html_content = script_pattern.sub(replace_js, html_content)
    
    # 6. Save Monolith HTML
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    size_kb = out_file.stat().st_size / 1024
    print("=" * 60)
    print(f"[SUCCESS] Monolith HTML created: {out_file}")
    print(f"[SIZE]    {size_kb:.2f} KB (Contains 151 official cards)")
    print("[RUN]     Open the file directly in any web browser (Chrome, Edge, Firefox)")
    print("=" * 60)
    return out_file

if __name__ == "__main__":
    build_monolith()
