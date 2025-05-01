import psycopg2
import requests
import hashlib
from collections import Counter, defaultdict
import concurrent.futures
import os
import sys
from urllib.parse import urlparse
import time # Import time for potential delays

# --- Configuration from Environment Variables ---
# PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL")
PG_TABLE_NAME = os.getenv("PG_TABLE_NAME", "arts")
PG_URL_COLUMN_NAME = os.getenv("PG_URL_COLUMN_NAME", "src")
PG_ID_COLUMN_NAME = os.getenv("PG_ID_COLUMN_NAME", "id") # Assumes INT/BIGINT for deletion

# Optional: Metadata table configuration
PG_METADATA_TABLE_NAME = os.getenv("PG_METADATA_TABLE_NAME", "art_metadata")
PG_METADATA_FK_COLUMN_NAME = os.getenv("PG_METADATA_FK_COLUMN_NAME", "art_id")

# --- Script Configuration ---
MAX_WORKERS = int(os.getenv("MAX_WORKERS", 10))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", 20))
MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", 50))
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
DELETE_DELAY_SECONDS = float(os.getenv("DELETE_DELAY_SECONDS", 0.1)) # Optional delay
# DRY_RUN is now controlled solely by environment variable
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"

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
            # Fetch ID as integer for deletion purposes
            query = f"SELECT {PG_ID_COLUMN_NAME}, {PG_URL_COLUMN_NAME} FROM {PG_TABLE_NAME} WHERE {PG_URL_COLUMN_NAME} IS NOT NULL AND {PG_URL_COLUMN_NAME} <> '';"
            cur.execute(query)
            results = cur.fetchall()
            # Keep original ID type (assuming int/bigint) for deletion
            data = [(row[0], row[1]) for row in results if row[0] is not None and row[1]]
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

def get_ids_with_metadata(conn, id_list):
    """Check which IDs from the list exist in the metadata table."""
    if not id_list or not PG_METADATA_TABLE_NAME or not PG_METADATA_FK_COLUMN_NAME:
        return set()

    ids_with_metadata = set()
    try:
        with conn.cursor() as cur:
            # Use tuple for IN clause
            ids_tuple = tuple(id_list)
            # Construct query safely
            query = f"SELECT {PG_METADATA_FK_COLUMN_NAME} FROM {PG_METADATA_TABLE_NAME} WHERE {PG_METADATA_FK_COLUMN_NAME} IN %s;"
            cur.execute(query, (ids_tuple,))
            results = cur.fetchall()
            ids_with_metadata = {row[0] for row in results}
    except psycopg2.Error as e:
        print(f"Warning: Error checking metadata for IDs {id_list}: {e}", file=sys.stderr)
        # Continue without metadata check for this batch if query fails
    return ids_with_metadata

# --- Main Execution ---

def process_duplicates():
    pg_conn = None
    processed_count = 0
    hashes_to_pg_ids = defaultdict(list) # Map: hash -> list of PG IDs
    error_summary = Counter()
    total_pg_items = 0
    ids_to_delete = []
    total_deleted_count = 0
    kept_ids_info = {} # hash -> kept_id

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
        if pg_conn: pg_conn.close() # Ensure connection is closed on error
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
                    hashes_to_pg_ids[img_hash].append(original_id) # Keep original ID type
                elif status != "success":
                    error_summary[status] += 1

                # Print progress
                if processed_count % 100 == 0 or processed_count == total_pg_items:
                     print(f"Hashed {processed_count}/{total_pg_items} items...")

            except Exception as exc:
                print(f"Item ID {original_id} generated an exception during future processing: {exc}", file=sys.stderr)
                error_summary["future_exception"] += 1

    print(f"\nFinished hashing {processed_count} PostgreSQL items.")

    # 3. Identify PostgreSQL Duplicates, Preferring those with Metadata
    postgres_duplicate_instances_found = 0
    print("\n--- Analyzing PostgreSQL Hashes for Deletion (Preferring Metadata) ---")
    can_check_metadata = bool(PG_METADATA_TABLE_NAME and PG_METADATA_FK_COLUMN_NAME)
    if not can_check_metadata:
        print("Metadata table/column not configured. Will keep the first encountered ID for duplicates.")

    for img_hash, id_list in hashes_to_pg_ids.items():
        if len(id_list) > 1:
            keep_id = None
            delete_ids_for_this_hash = []

            if can_check_metadata:
                ids_with_meta = get_ids_with_metadata(pg_conn, id_list)
                if len(ids_with_meta) == 1:
                    # Ideal case: Exactly one has metadata, keep it.
                    keep_id = list(ids_with_meta)[0]
                    print(f"  Hash {img_hash[:8]}... Found {len(id_list)} instances. Keeping ID {keep_id} (has metadata).")
                elif len(ids_with_meta) > 1:
                    # Multiple have metadata, keep the first one found with metadata, warn user.
                    keep_id = sorted(list(ids_with_meta))[0] # Keep the smallest ID among those with metadata
                    print(f"  Warning: Hash {img_hash[:8]}... Found {len(id_list)} instances. Multiple ({len(ids_with_meta)}) have metadata: {ids_with_meta}. Keeping first: {keep_id}.")
                # else len(ids_with_meta) == 0 - handled below
            
            if keep_id is None:
                 # No metadata check possible, or none had metadata. Keep the first encountered ID.
                 keep_id = id_list[0]
                 if can_check_metadata: # Only print this if we tried and failed
                     print(f"  Hash {img_hash[:8]}... Found {len(id_list)} instances. None have metadata. Keeping first encountered: {keep_id}.")
                 # else: just keep first silently if metadata check was disabled.

            # Add all other IDs to the delete list
            delete_ids_for_this_hash = [id_ for id_ in id_list if id_ != keep_id]
            ids_to_delete.extend(delete_ids_for_this_hash)
            postgres_duplicate_instances_found += len(delete_ids_for_this_hash)
            kept_ids_info[img_hash] = keep_id # Store which ID was kept for this hash

    print(f"\nIdentified {postgres_duplicate_instances_found} duplicate instances to delete.")
    print(f"Total unique PostgreSQL IDs marked for deletion: {len(ids_to_delete)}")

    # 4. Delete Duplicates from PostgreSQL (No Confirmation Prompt)
    if not ids_to_delete:
        print("\nNo duplicate entries to delete.")
    else:
        if DRY_RUN:
            print("\n--- DRY RUN MODE ---")
            print(f"Would delete {len(ids_to_delete)} duplicate entries with the following IDs:")
            # Print IDs in batches for readability if there are many
            batch_size = 20
            for i in range(0, len(ids_to_delete), batch_size):
                print(f"  {ids_to_delete[i:i+batch_size]}")
            print("--- END DRY RUN ---")
        else:
            print("\n--- DELETING DUPLICATES (NO CONFIRMATION) ---")
            print(f"Proceeding to delete {len(ids_to_delete)} entries from '{PG_TABLE_NAME}'.")
            try:
                with pg_conn.cursor() as cur:
                    # Delete in batches or one by one with delay to reduce load
                    # Using IN clause is generally more efficient for larger sets
                    # If cascading is set up correctly, related data will be handled.
                    delete_query = f"DELETE FROM {PG_TABLE_NAME} WHERE {PG_ID_COLUMN_NAME} = %s;"
                    for item_id in ids_to_delete:
                        try:
                            cur.execute(delete_query, (item_id,))
                            deleted_in_batch = cur.rowcount # Count affected rows for this ID
                            total_deleted_count += deleted_in_batch
                            if deleted_in_batch > 0:
                                print(f"Deleted ID: {item_id} (Affected rows: {deleted_in_batch})")
                            else:
                                print(f"Warning: Delete command for ID {item_id} affected 0 rows (was it already deleted?).", file=sys.stderr)

                            if DELETE_DELAY_SECONDS > 0:
                                time.sleep(DELETE_DELAY_SECONDS) # Optional delay
                        except psycopg2.Error as delete_err:
                            print(f"Error deleting ID {item_id}: {delete_err}. Rolling back this attempt.", file=sys.stderr)
                            pg_conn.rollback() # Rollback this specific delete attempt
                    # Only commit if the loop completes without critical errors causing sys.exit
                    pg_conn.commit()
                print(f"\nDeletion process finished. Total entries deleted in this run: {total_deleted_count}")
            except psycopg2.Error as e:
                print(f"\nCRITICAL: Error during deletion transaction: {e}", file=sys.stderr)
                print("Attempting to rollback transaction.")
                try: pg_conn.rollback()
                except Exception as rb_err: print(f"Rollback failed: {rb_err}", file=sys.stderr)
                total_deleted_count = 0 # Reset count as commit likely failed
            except Exception as e:
                 print(f"\nCRITICAL: Unexpected error during deletion: {e}", file=sys.stderr)
                 print("Attempting to rollback transaction.")
                 try: pg_conn.rollback()
                 except Exception as rb_err: print(f"Rollback failed: {rb_err}", file=sys.stderr)
                 total_deleted_count = 0

    # 5. Report Final Results
    print("\n--- Final Summary ---")
    print(f"Total PostgreSQL items processed: {total_pg_items}")
    successful_hashes = len(hashes_to_pg_ids)
    print(f"Successfully hashed items: {successful_hashes}")
    unique_images = len(hashes_to_pg_ids)
    print(f"Unique images found (based on hash): {unique_images}")

    if error_summary:
        total_errors = sum(error_summary.values())
        print(f"Failed or skipped items during hashing: {total_errors}")
        for reason, count in error_summary.most_common():
            print(f"  - {reason}: {count}")

    print(f"\nDuplicate instances identified in PostgreSQL: {postgres_duplicate_instances_found}")
    if DRY_RUN:
         print(f"Action: DRY RUN - No entries were deleted.")
    elif total_deleted_count > 0:
         print(f"Action: DELETED {total_deleted_count} duplicate entries from PostgreSQL.")
    elif ids_to_delete: # We intended to delete but counter is 0
         print(f"Action: Deletion attempted but 0 entries reported deleted (check logs/DB).")
    else:
        print(f"Action: No duplicates identified to delete.")

    # Close PG connection
    if pg_conn:
        pg_conn.close()
        print("\nPostgreSQL connection closed.")

if __name__ == "__main__":
    process_duplicates()
    print("\n--- Script Finished ---")