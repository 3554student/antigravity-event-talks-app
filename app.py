import os
import re
import time
import html
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Feed URL
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# Cache for release notes
cache = {
    "data": None,
    "last_fetched": 0,
    "expires_at": 0
}
CACHE_DURATION = 300  # 5 minutes in seconds

def clean_html_content(content):
    """
    Cleans up description HTML, fixes relative URLs and formatting.
    """
    # Fix links that might be relative
    content = content.replace('href="/', 'href="https://docs.cloud.google.com/')
    content = content.replace('href="https://cloud.google.com/', 'href="https://cloud.google.com/')
    return content

def parse_release_notes(xml_content):
    namespace = {'atom': 'http://www.w3.org/2005/Atom'}
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        print(f"XML Parsing Error: {e}")
        return []
    
    entries = []
    # Loop over entries in feed
    for idx, entry in enumerate(root.findall('atom:entry', namespace)):
        title_el = entry.find('atom:title', namespace)
        updated_el = entry.find('atom:updated', namespace)
        link_el = entry.find('atom:link[@rel="alternate"]', namespace)
        if link_el is None:
            link_el = entry.find('atom:link', namespace)
        content_el = entry.find('atom:content', namespace)
        
        date_str = title_el.text.strip() if title_el is not None else ""
        updated_val = updated_el.text.strip() if updated_el is not None else ""
        link_val = link_el.attrib.get('href', '').strip() if link_el is not None else ""
        content_html = content_el.text if content_el is not None else ""
        
        # Split content into individual updates by <h3>
        # Each entry (a specific date) can contain multiple update types (Feature, Announcement, Issue, etc.)
        parts = re.split(r'<h3>(.*?)</h3>', content_html)
        
        if len(parts) >= 3:
            for i in range(1, len(parts), 2):
                update_type = parts[i].strip()
                update_body = parts[i+1].strip() if i+1 < len(parts) else ""
                
                # Make a clean text version for Twitter sharing
                clean_text = re.sub(r'<[^>]+>', '', update_body)
                clean_text = html.unescape(clean_text)
                clean_text = re.sub(r'\s+', ' ', clean_text).strip()
                
                # Format a unique, stable ID for selection
                safe_type = re.sub(r'[^a-zA-Z0-9]', '', update_type).lower()
                entry_id = f"note-{idx}-{i}-{safe_type}"
                
                entries.append({
                    "id": entry_id,
                    "date": date_str,
                    "updated": updated_val,
                    "link": link_val,
                    "type": update_type,
                    "html": clean_html_content(update_body),
                    "text": clean_text
                })
        else:
            # Fallback when there are no <h3> tags
            clean_text = re.sub(r'<[^>]+>', '', content_html)
            clean_text = html.unescape(clean_text)
            clean_text = re.sub(r'\s+', ' ', clean_text).strip()
            
            entry_id = f"note-{idx}-default"
            entries.append({
                "id": entry_id,
                "date": date_str,
                "updated": updated_val,
                "link": link_val,
                "type": "Update",
                "html": clean_html_content(content_html),
                "text": clean_text
            })
            
    return entries

def fetch_feed(force=False):
    current_time = time.time()
    
    # Return cached data if valid and force_refresh is not requested
    if not force and cache["data"] is not None and current_time < cache["expires_at"]:
        return cache["data"], "cache", cache["last_fetched"]
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        parsed_notes = parse_release_notes(response.content)
        
        # Update cache
        cache["data"] = parsed_notes
        cache["last_fetched"] = current_time
        cache["expires_at"] = current_time + CACHE_DURATION
        
        return parsed_notes, "live", current_time
    except Exception as e:
        print(f"Error fetching feed: {e}")
        # Return cache if available as a fallback
        if cache["data"] is not None:
            return cache["data"], "fallback", cache["last_fetched"]
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force = request.args.get('force_refresh', 'false').lower() == 'true'
    try:
        notes, source, fetched_time = fetch_feed(force=force)
        return jsonify({
            "success": True,
            "notes": notes,
            "source": source,
            "fetched_at": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(fetched_time)),
            "count": len(notes)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    # Enable debugging and listen on all interfaces
    app.run(debug=True, port=5000)
