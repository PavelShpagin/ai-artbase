import psycopg2
import requests
import hashlib
from collections import Counter, defaultdict
import concurrent.futures
import os
import sys
import chromadb
from urllib.parse import urlparse

# --- Configuration from Environment Variables ---
# PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL")
PG_TABLE_NAME = "arts"
PG_URL_COLUMN_NAME = "src"
PG_ID_COLUMN_NAME = "id" # IMPORTANT: Assumes IDs are strings or convertible

# ChromaDB Configuration (only for ID checking)
CHROMA_HOST = "chromadb" # Required if checking Chroma
CHROMA_PORT = "8001"
CHROMA_COLLECTION_NAME = "Prompts" # Required if checking Chroma

# --- Script Configuration ---
MAX_WORKERS = int(os.getenv("MAX_WORKERS", 10))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 20))
MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", 50))
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

# --- Helper Functions ---

def parse_database_url(url):
    """Parses DATABASE_URL into components for psycopg2."""
    if not url: return None
    try:
        parsed = urlparse(url)
        return {
            "dbname": parsed.path[1:], "user": parsed.username,
            "password": parsed.password, "host": parsed.hostname,
            "port": parsed.port or 5432,
        }
    except Exception as e:
        print(f"Error parsing DATABASE_URL: {e}", file=sys.stderr)
        return None

def fetch_pg_image_data(conn):
    """Fetches ID and URL pairs from the PostgreSQL table."""
    data = [] # List of (id, url) tuples
    try:
        with conn.cursor() as cur:
            print(f"Fetching IDs ('{PG_ID_COLUMN_NAME}') and URLs ('{PG_URL_COLUMN_NAME}') from PostgreSQL table '{PG_TABLE_NAME}'...")
            # Ensure ID column is selected first
            query = f"SELECT {PG_ID_COLUMN_NAME}, {PG_URL_COLUMN_NAME} FROM {PG_TABLE_NAME} WHERE {PG_URL_COLUMN_NAME} IS NOT NULL AND {PG_URL_COLUMN_NAME} <> '';"
            cur.execute(query)
            results = cur.fetchall()
            # Ensure IDs are stored as strings, as Chroma expects string IDs
            data = [(str(row[0]), row[1]) for row in results if row[0] is not None and row[1]]
            print(f"Fetched {len(data)} valid (ID, URL) pairs from PostgreSQL.")
    except psycopg2.Error as e:
        print(f"PostgreSQL error fetching data: {e}", file=sys.stderr)
        raise # Reraise as this is critical for the script's purpose
    return data

def download_and_hash_image(item_id, url):
    """Downloads image from URL and returns its SHA256 hash along with the item ID."""
    # Basic URL validation included in the download logic
    if not url or not isinstance(url, str) or not url.startswith(('http://', 'https://')):
        return item_id, None, "invalid_url_format"

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; ImageDeduplicationBot/1.0)'}
        response = requests.get(url, stream=True, timeout=REQUEST_TIMEOUT, headers=headers)
        response.raise_for_status()

        content_type = response.headers.get('content-type', '').lower()
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/avif']
        if not any(allowed_type in content_type for allowed_type in allowed_types):
             return item_id, None, "wrong_content_type"

        hasher = hashlib.sha256()
        bytes_read = 0
        for chunk in response.iter_content(chunk_size=8192):
            if bytes_read > MAX_IMAGE_SIZE_BYTES:
                # print(f"Warning: Image {url} (ID: {item_id}) exceeds max size. Skipping.", file=sys.stderr)
                return item_id, None, "exceeded_max_size"
            hasher.update(chunk)
            bytes_read += len(chunk)

        if bytes_read == 0:
             # print(f"Warning: Image {url} (ID: {item_id}) downloaded 0 bytes. Skipping.", file=sys.stderr)
             return item_id, None, "zero_bytes"

        return item_id, hasher.hexdigest(), "success"
    except requests.exceptions.Timeout:
        return item_id, None, "timeout"
    except requests.exceptions.RequestException as e:
        return item_id, None, f"download_error:_{type(e).__name__}"
    except Exception as e:
        print(f"Unexpected error processing URL {url} (ID: {item_id}): {e}", file=sys.stderr)
        return item_id, None, f"unexpected_error:_{type(e).__name__}"

def check_chroma_ids_exist(ids_to_check):
    """Checks which of the given IDs exist in the ChromaDB collection."""
    if not ids_to_check:
        return 0 # No IDs to check

    found_count = 0
    ids_list = list(ids_to_check) # Ensure it's a list for Chroma client
    print(f"\nChecking {len(ids_list)} PostgreSQL duplicate IDs against ChromaDB collection '{CHROMA_COLLECTION_NAME}'...")

    try:
        chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        # Optional: Heartbeat check
        try: chroma_client.heartbeat(); print("ChromaDB connection successful.")
        except Exception as e: print(f"Warning: ChromaDB heartbeat failed: {e}. Proceeding...", file=sys.stderr)

        collection = chroma_client.get_collection(name=CHROMA_COLLECTION_NAME)

        # ChromaDB's get expects a list of string IDs.
        # It returns only the items that *were* found.
        # We need to handle potential errors during the get call itself.
        batch_size = 500 # Check IDs in batches to avoid overly large requests
        for i in range(0, len(ids_list), batch_size):
            batch_ids = ids_list[i:i+batch_size]
            try:
                results = collection.get(ids=batch_ids, include=[]) # We only care about existence, not data
                found_count += len(results.get('ids', []))
                print(f"Checked batch {i//batch_size + 1}/{(len(ids_list) + batch_size - 1)//batch_size}, found so far: {found_count}")
            except Exception as batch_e:
                 # Log error for the specific batch but continue if possible
                 print(f"Error checking ChromaDB ID batch starting at index {i}: {batch_e}", file=sys.stderr)


        print(f"Finished ChromaDB check. Found {found_count} matching IDs.")
        return found_count

    except Exception as e:
        print(f"CRITICAL: Failed to connect to or query ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}", file=sys.stderr)
        print(f"Error: {e}", file=sys.stderr)
        print("Cannot determine coincidence count. Returning 0.", file=sys.stderr)
        return 0 # Indicate failure to check

# --- Main Execution ---

def process_duplicates():
    pg_conn = None
    processed_count = 0
    hashes_to_pg_ids = defaultdict(list) # Map: hash -> list of PG IDs
    error_summary = Counter()
    total_pg_items = 0

    # 1. Connect to PostgreSQL and Fetch Data
    pg_connection_params = parse_database_url(DATABASE_URL)
    if not pg_connection_params:
        print("CRITICAL: DATABASE_URL is missing or invalid. Cannot proceed.", file=sys.stderr)
        sys.exit(1)

    print(f"Attempting PostgreSQL connection to host '{pg_connection_params.get('host')}'...")
    try:
        pg_conn = psycopg2.connect(**pg_connection_params)
        print("PostgreSQL connection successful.")
        pg_data = fetch_pg_image_data(pg_conn) # List of (id, url)
        total_pg_items = len(pg_data)
    except Exception as e: # Catch potential fetch errors too
        print(f"\nCRITICAL: Failed to connect to or fetch data from PostgreSQL: {e}", file=sys.stderr)
        sys.exit(1)

    if not pg_data:
        print("No (ID, URL) pairs found in PostgreSQL. Exiting.")
        if pg_conn: pg_conn.close()
        return

    # 2. Hash Images from PostgreSQL URLs Concurrently
    print(f"\nStarting hashing for {total_pg_items} items from PostgreSQL using up to {MAX_WORKERS} workers...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit tasks: download_and_hash_image needs (id, url)
        future_to_id = {executor.submit(download_and_hash_image, item_id, url): item_id for item_id, url in pg_data}

        for future in concurrent.futures.as_completed(future_to_id):
            original_id = future_to_id[future]
            processed_count += 1
            try:
                returned_id, img_hash, status = future.result()
                # Sanity check ID hasn't changed
                if original_id != returned_id:
                     print(f"CRITICAL internal error: ID mismatch for future {original_id} != {returned_id}", file=sys.stderr)
                     error_summary["internal_id_mismatch"] += 1
                     continue # Skip this result

                if img_hash and status == "success":
                    hashes_to_pg_ids[img_hash].append(original_id)
                elif status != "success":
                    error_summary[status] += 1

                # Print progress
                if processed_count % 100 == 0 or processed_count == total_pg_items:
                     print(f"Hashed {processed_count}/{total_pg_items} items...")

            except Exception as exc:
                print(f"Item ID {original_id} generated an exception during future processing: {exc}", file=sys.stderr)
                error_summary["future_exception"] += 1

    print(f"\nFinished hashing {processed_count} PostgreSQL items.")

    # 3. Analyze Hashes for PostgreSQL Duplicates
    postgres_duplicate_instances = 0
    duplicate_pg_ids = set() # Set of unique PG IDs that are part of any duplicate group

    print("\n--- Analyzing PostgreSQL Hashes ---")
    for img_hash, id_list in hashes_to_pg_ids.items():
        if len(id_list) > 1:
            # This hash represents a duplicate image within PostgreSQL
            duplicates_in_group = len(id_list) - 1
            postgres_duplicate_instances += duplicates_in_group
            # Add all IDs from this duplicate group to the set
            duplicate_pg_ids.update(id_list)
            # print(f"  Hash {img_hash[:8]}... found {len(id_list)} times (IDs: {id_list})") # Debugging

    print(f"Total duplicate instances found in PostgreSQL: {postgres_duplicate_instances}")
    print(f"Total unique PostgreSQL IDs involved in duplicates: {len(duplicate_pg_ids)}")

    # 4. Check Coincidence in ChromaDB (if configured)
    chromadb_coincident_duplicate_count = 0
    if CHROMA_HOST and CHROMA_COLLECTION_NAME:
        if not duplicate_pg_ids:
            print("\nNo duplicates found in PostgreSQL, skipping ChromaDB check.")
        else:
             # Pass the unique IDs of the PG duplicates to the check function
            chromadb_coincident_duplicate_count = check_chroma_ids_exist(duplicate_pg_ids)
    elif duplicate_pg_ids:
         print("\nChromaDB host or collection name not configured. Skipping coincidence check.")
    # else: pass # No duplicates and no chroma config = nothing to do

    # 5. Report Final Results
    print("\n--- Final Summary ---")
    print(f"Total PostgreSQL items processed: {total_pg_items}")
    successful_hashes = len(hashes_to_pg_ids)
    print(f"Successfully hashed items: {successful_hashes}")
    if error_summary:
        total_errors = sum(error_summary.values())
        print(f"Failed or skipped items: {total_errors}")
        for reason, count in error_summary.most_common():
            print(f"  - {reason}: {count}")

    print(f"\nDuplicate instances based on content hash in PostgreSQL: {postgres_duplicate_instances}")
    if CHROMA_HOST and CHROMA_COLLECTION_NAME:
        print(f"PostgreSQL duplicate IDs also found in ChromaDB collection '{CHROMA_COLLECTION_NAME}': {chromadb_coincident_duplicate_count}")
    else:
        print("(ChromaDB coincidence check skipped)")


    # Close PG connection
    if pg_conn:
        pg_conn.close()
        print("\nPostgreSQL connection closed.")


if __name__ == "__main__":
    process_duplicates()