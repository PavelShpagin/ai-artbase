import psycopg2
import requests
import os
import sys
from urllib.parse import urlparse
import time # Import time for potential delays
from collections import Counter, defaultdict
import concurrent.futures
from PIL import Image
import imagehash
from io import BytesIO
import numpy as np # <-- Add numpy import
from sklearn.cluster import MiniBatchKMeans
from dotenv import load_dotenv

# --- LSH related imports ---
from datasketch import MinHash, MinHashLSH

# Load environment variables from .env file
load_dotenv()

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
DRY_RUN = False
PHASH_DISTANCE_THRESHOLD = int(os.getenv("PHASH_DISTANCE_THRESHOLD", 5))

# --- LSH Specific Configuration ---
LSH_NUM_PERM = 128            # Number of permutations for MinHash (higher=more accurate but slower)
LSH_JACCARD_THRESHOLD = 0.8   # Jaccard similarity threshold for LSH candidates (0.0-1.0)
                              # Higher threshold = stricter candidate selection

# --- Helper Functions ---

def parse_database_url(url):
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
    data = []
    try:
        with conn.cursor() as cur:
            print(f"Fetching IDs ('{PG_ID_COLUMN_NAME}') and URLs ('{PG_URL_COLUMN_NAME}') from PostgreSQL table '{PG_TABLE_NAME}'...")
            query = f"SELECT {PG_ID_COLUMN_NAME}, {PG_URL_COLUMN_NAME} FROM {PG_TABLE_NAME} WHERE {PG_URL_COLUMN_NAME} IS NOT NULL AND {PG_URL_COLUMN_NAME} <> '';"
            cur.execute(query)
            results = cur.fetchall()
            data = [(row[0], row[1]) for row in results if row[0] is not None and row[1]]
            print(f"Fetched {len(data)} valid (ID, URL) pairs from PostgreSQL.")
    except psycopg2.Error as e:
        print(f"PostgreSQL error fetching data: {e}", file=sys.stderr)
        raise
    return data

def download_and_phash_image(item_id, url):
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
        img_bytes = BytesIO()
        bytes_read = 0
        for chunk in response.iter_content(chunk_size=8192):
            if bytes_read > MAX_IMAGE_SIZE_BYTES:
                return item_id, None, "exceeded_max_size"
            img_bytes.write(chunk)
            bytes_read += len(chunk)
        if bytes_read == 0:
            return item_id, None, "zero_bytes"
        img_bytes.seek(0)
        img = Image.open(img_bytes)
        phash = imagehash.phash(img)
        return item_id, phash, "success"
    except requests.exceptions.Timeout:
        return item_id, None, "timeout"
    except requests.exceptions.RequestException as e:
        return item_id, None, f"download_error:_{type(e).__name__}"
    except Exception as e:
        print(f"Unexpected error processing URL {url} (ID: {item_id}): {e}", file=sys.stderr)
        return item_id, None, f"unexpected_error:_{type(e).__name__}"

def get_ids_with_metadata(conn, id_list):
    if not id_list or not PG_METADATA_TABLE_NAME or not PG_METADATA_FK_COLUMN_NAME:
        return set()
    ids_with_metadata = set()
    try:
        with conn.cursor() as cur:
            ids_tuple = tuple(id_list)
            query = f"SELECT {PG_METADATA_FK_COLUMN_NAME} FROM {PG_METADATA_TABLE_NAME} WHERE {PG_METADATA_FK_COLUMN_NAME} IN %s;"
            cur.execute(query, (ids_tuple,))
            results = cur.fetchall()
            ids_with_metadata = {row[0] for row in results}
    except psycopg2.Error as e:
        print(f"Warning: Error checking metadata for IDs {id_list}: {e}", file=sys.stderr)
    return ids_with_metadata

# --- LSH Helper Function ---
def create_minhash(phash_obj, num_perm):
    """Creates a MinHash object from an imagehash phash object."""
    if phash_obj is None or phash_obj.hash is None:
        return None
    # Convert the boolean hash array into a set of features (indices of True bits).
    true_indices = np.where(phash_obj.hash.flatten())[0]
    feature_set = {str(i) for i in true_indices} # Use string representation

    m = MinHash(num_perm=num_perm)
    if not feature_set: # Handle case of all-False hash if it occurs
        return m
    for feature in feature_set:
        m.update(feature.encode('utf8'))
    return m

# --- Main Execution ---
def process_duplicates():
    pg_conn = None
    processed_count = 0
    phashes_and_ids = {}  # Dictionary: {id: phash_object}
    error_summary = Counter()
    total_pg_items = 0
    total_deleted_count = 0

    pg_connection_params = parse_database_url(DATABASE_URL)
    if not pg_connection_params:
        print("CRITICAL: DATABASE_URL is missing or invalid. Cannot proceed.", file=sys.stderr)
        sys.exit(1)

    print(f"Attempting PostgreSQL connection to host '{pg_connection_params.get('host')}'...")
    try:
        pg_conn = psycopg2.connect(**pg_connection_params)
        print("PostgreSQL connection successful.")
        pg_data = fetch_pg_image_data(pg_conn)
        total_pg_items = len(pg_data)
    except Exception as e:
        print(f"\nCRITICAL: Failed to connect to or fetch data from PostgreSQL: {e}", file=sys.stderr)
        if pg_conn: pg_conn.close()
        sys.exit(1)

    if not pg_data:
        print("No (ID, URL) pairs found in PostgreSQL. Exiting.")
        if pg_conn: pg_conn.close()
        return

    print(f"\nStarting perceptual hashing for {total_pg_items} items from PostgreSQL using up to {MAX_WORKERS} workers...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_id = {executor.submit(download_and_phash_image, item_id, url): item_id for item_id, url in pg_data}
        for future in concurrent.futures.as_completed(future_to_id):
            original_id = future_to_id[future]
            processed_count += 1
            try:
                returned_id, phash_obj, status = future.result()
                if original_id != returned_id:
                    print(f"CRITICAL internal error: ID mismatch for future {original_id} != {returned_id}", file=sys.stderr)
                    error_summary["internal_id_mismatch"] += 1
                    continue
                if phash_obj and status == "success":
                    phashes_and_ids[original_id] = phash_obj # Store as ID -> pHash object
                elif status != "success":
                    error_summary[status] += 1
                if processed_count % 100 == 0 or processed_count == total_pg_items:
                    print(f"Hashed {processed_count}/{total_pg_items} items...")
            except Exception as exc:
                print(f"Item ID {original_id} generated an exception during future processing: {exc}", file=sys.stderr)
                error_summary["future_exception"] += 1
    print(f"\nFinished perceptual hashing {processed_count} PostgreSQL items.")
    print(f"Successfully generated {len(phashes_and_ids)} phashes.")

    # --- LSH Indexing and Querying ---
    print(f"\n--- Building MinHashLSH Index (Num Perm: {LSH_NUM_PERM}, Jaccard Threshold: {LSH_JACCARD_THRESHOLD}) ---")

    if not phashes_and_ids:
        print("No valid hashes generated, skipping LSH and deletion.")
        ids_to_delete = set() # Use set for efficient addition
    else:
        # 1. Create LSH index
        lsh = MinHashLSH(threshold=LSH_JACCARD_THRESHOLD, num_perm=LSH_NUM_PERM)
        minhashes = {} # Store minhashes: {id: minhash_object}

        # 2. Create MinHash objects and insert into LSH index
        print("Generating MinHashes and populating LSH index...")
        insertion_count = 0
        for item_id, phash_obj in phashes_and_ids.items():
            minhash_obj = create_minhash(phash_obj, LSH_NUM_PERM)
            if minhash_obj:
                minhashes[item_id] = minhash_obj
                # Use item_id (which should be unique) as the key for LSH insertion
                lsh.insert(item_id, minhash_obj)
                insertion_count += 1
        print(f"Inserted {insertion_count} items into LSH index.")

        # 3. Find duplicate groups using LSH and refine with Hamming distance
        print("Querying LSH and refining with Hamming distance to find duplicates...")
        ids_to_delete = set()
        processed_ids = set() # Keep track of IDs already part of a processed duplicate group
        potential_duplicate_groups = 0

        all_hashed_ids = list(minhashes.keys()) # IDs that have a valid MinHash

        for current_id in all_hashed_ids:
            if current_id in processed_ids:
                continue # Skip if already handled in another group

            current_minhash = minhashes[current_id]
            # Query LSH for potential matches for the current item's MinHash
            # The result contains the keys (item_ids) of potential matches
            candidate_ids = lsh.query(current_minhash)

            # Refine candidates using exact Hamming distance
            current_duplicate_group = {current_id} # Start group with the current item
            if candidate_ids: # Check if LSH returned any candidates
                 current_phash = phashes_and_ids[current_id]
                 for candidate_id in candidate_ids:
                     # Don't compare with self, ensure candidate has phash, and hasn't been processed
                     if candidate_id != current_id and candidate_id in phashes_and_ids and candidate_id not in processed_ids:
                         candidate_phash = phashes_and_ids[candidate_id]
                         # Calculate exact Hamming distance
                         hamming_dist = current_phash - candidate_phash
                         if hamming_dist <= PHASH_DISTANCE_THRESHOLD:
                             current_duplicate_group.add(candidate_id) # Add to the group if similar enough

            # Process the identified duplicate group
            if len(current_duplicate_group) > 1:
                potential_duplicate_groups += 1
                keep_id = None
                group_list = list(current_duplicate_group) # Convert set to list for metadata check

                # --- Keep ID selection logic (same as before) ---
                can_check_metadata = bool(PG_METADATA_TABLE_NAME and PG_METADATA_FK_COLUMN_NAME)
                if can_check_metadata:
                    ids_with_meta = get_ids_with_metadata(pg_conn, group_list)
                    potential_keeps_meta = [id_ for id_ in group_list if id_ in ids_with_meta]

                    if len(potential_keeps_meta) == 1:
                        keep_id = potential_keeps_meta[0]
                    elif len(potential_keeps_meta) > 1:
                        # If multiple have metadata, keep the one with the lowest ID among them
                        keep_id = min(potential_keeps_meta)
                    # If len == 0, fall through to min ID logic

                # If no metadata preference, keep the item with the numerically smallest ID
                if keep_id is None:
                    keep_id = min(group_list)

                # Add others from the group to the delete set
                for item_id in current_duplicate_group:
                    if item_id != keep_id:
                        ids_to_delete.add(item_id)
                # Optional: print(f"  Duplicate Group (size {len(current_duplicate_group)}): {group_list} -> Keeping {keep_id}")

            # Mark all members of this group (even if size=1) as processed
            processed_ids.update(current_duplicate_group)

        print(f"Finished LSH querying. Identified {potential_duplicate_groups} groups with potential duplicates.")

    # Convert set to list for deletion logic compatibility (and sorting)
    ids_to_delete_list = sorted(list(ids_to_delete))

    # --- Deletion Logic ---
    print(f"\nTotal unique PostgreSQL IDs marked for deletion: {len(ids_to_delete_list)}")

    # Delete Duplicates from PostgreSQL
    if not ids_to_delete_list:
        print("\nNo duplicate entries to delete.")
    else:
        if DRY_RUN:
            print("\n--- DRY RUN MODE ---")
            print(f"Would delete {len(ids_to_delete_list)} duplicate entries with the following IDs:")
            batch_size = 20
            for i in range(0, len(ids_to_delete_list), batch_size):
                print(f"  {ids_to_delete_list[i:i+batch_size]}")
            print("--- END DRY RUN ---")
        else:
            # --- ACTUAL DELETION ---
            print(f"\n--- DELETING DUPLICATES (DRY_RUN = {DRY_RUN}) ---")
            print(f"Proceeding to delete {len(ids_to_delete_list)} entries from '{PG_TABLE_NAME}'.")
            try:
                with pg_conn.cursor() as cur:
                    # Use DELETE ... WHERE id = ANY(%s) for better performance if possible
                    # Requires converting the list to a format psycopg2 understands for ANY
                    # Example: cur.execute(f"DELETE FROM {PG_TABLE_NAME} WHERE {PG_ID_COLUMN_NAME} = ANY(%s::int[])", (ids_to_delete_list,))
                    # Using individual deletes for simplicity and delay compatibility for now:
                    delete_query = f"DELETE FROM {PG_TABLE_NAME} WHERE {PG_ID_COLUMN_NAME} = %s;"
                    for item_id in ids_to_delete_list:
                        try:
                            # Ensure item_id is correct type for query placeholder
                            cur.execute(delete_query, (int(item_id),))
                            deleted_in_batch = cur.rowcount
                            if deleted_in_batch > 0:
                                total_deleted_count += deleted_in_batch
                                print(f"Deleted ID: {item_id} (Affected rows: {deleted_in_batch})")
                            else:
                                # This might happen if the ID was already deleted in a previous run or concurrently
                                print(f"Warning: Delete command for ID {item_id} affected 0 rows.", file=sys.stderr)
                            if DELETE_DELAY_SECONDS > 0:
                                time.sleep(DELETE_DELAY_SECONDS)
                        except psycopg2.Error as delete_err:
                            print(f"Error deleting ID {item_id}: {delete_err}. Rolling back this item, continuing...", file=sys.stderr)
                            # Attempt to rollback the single failed statement if possible, might need connection-level rollback
                            try: pg_conn.rollback() # Rollback the transaction state to before the failed delete
                            except Exception as rb_err: print(f"Rollback failed: {rb_err}", file=sys.stderr)
                            # Re-start transaction block if rollback was successful
                            pg_conn.autocommit = False # Ensure we are back in a transaction if needed
                    # Commit the entire transaction only if all deletes (or those not rolled back) succeeded
                    pg_conn.commit()
                print(f"\nDeletion process finished. Total entries deleted in this run: {total_deleted_count}")
            except psycopg2.Error as e:
                print(f"\nCRITICAL: Error during deletion transaction: {e}", file=sys.stderr)
                print("Attempting to rollback transaction.")
                try: pg_conn.rollback()
                except Exception as rb_err: print(f"Rollback failed: {rb_err}", file=sys.stderr)
                total_deleted_count = 0 # Reset count as transaction failed
            except Exception as e:
                print(f"\nCRITICAL: Unexpected error during deletion: {e}", file=sys.stderr)
                print("Attempting to rollback transaction.")
                try: pg_conn.rollback()
                except Exception as rb_err: print(f"Rollback failed: {rb_err}", file=sys.stderr)
                total_deleted_count = 0 # Reset count as transaction failed

    # --- Final Report ---
    print("\n--- Final Summary ---")
    print(f"Total PostgreSQL items fetched: {total_pg_items}")
    print(f"Successfully hashed items: {len(phashes_and_ids)}")
    if error_summary:
        total_errors = sum(error_summary.values())
        print(f"Failed or skipped items during hashing: {total_errors}")
        for reason, count in error_summary.most_common():
            print(f"  - {reason}: {count}")
    print(f"\nDuplicate instances marked for deletion via LSH + Hamming: {len(ids_to_delete_list)}")
    if DRY_RUN:
        print(f"Action: DRY RUN - No entries were actually deleted.")
    elif total_deleted_count > 0:
        print(f"Action: DELETED {total_deleted_count} duplicate entries from PostgreSQL.")
    elif ids_to_delete_list: # Items were marked, but deletion count is 0
        print(f"Action: Deletion attempted but {total_deleted_count} entries reported deleted (check logs/DB).")
    else: # No items marked for deletion
        print(f"Action: No duplicates identified meeting the threshold.")

    # --- Cleanup ---
    if pg_conn:
        pg_conn.close()
        print("\nPostgreSQL connection closed.")

if __name__ == "__main__":
    start_time = time.time()
    # Make sure DRY_RUN is set appropriately above before running!
    print("Starting duplicate detection process...")
    print(f"DRY_RUN mode is currently: {'ENABLED' if DRY_RUN else 'DISABLED'}")
    if not DRY_RUN:
        print("WARNING: DRY_RUN is DISABLED. The script WILL attempt to delete rows from the database.")
        # Optional: Add a small delay/prompt here if running interactively
        # time.sleep(5)
    process_duplicates()
    end_time = time.time()
    print(f"\nScript finished in {end_time - start_time:.2f} seconds.")