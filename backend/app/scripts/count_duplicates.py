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
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
PHASH_DISTANCE_THRESHOLD = int(os.getenv("PHASH_DISTANCE_THRESHOLD", 5))

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

# --- Main Execution ---
def process_duplicates():
    pg_conn = None
    processed_count = 0
    phashes_and_ids = []  # List of (phash, id)
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
                returned_id, phash, status = future.result()
                if original_id != returned_id:
                    print(f"CRITICAL internal error: ID mismatch for future {original_id} != {returned_id}", file=sys.stderr)
                    error_summary["internal_id_mismatch"] += 1
                    continue
                if phash and status == "success":
                    phashes_and_ids.append((phash, original_id))
                elif status != "success":
                    error_summary[status] += 1
                if processed_count % 100 == 0 or processed_count == total_pg_items:
                    print(f"Hashed {processed_count}/{total_pg_items} items...")
            except Exception as exc:
                print(f"Item ID {original_id} generated an exception during future processing: {exc}", file=sys.stderr)
                error_summary["future_exception"] += 1
    print(f"\nFinished perceptual hashing {processed_count} PostgreSQL items.")

    # --- Clustering with MiniBatchKMeans ---
    # Note: MiniBatchKMeans uses Euclidean distance. We use boolean arrays (0/1) derived from phash.
    # The squared Euclidean distance between these is equal to the Hamming distance.
    # So, MiniBatchKMeans threshold should be approx. sqrt(desired Hamming threshold).
    mbk_threshold = np.sqrt(PHASH_DISTANCE_THRESHOLD)
    print(f"\n--- Clustering {len(phashes_and_ids)} images using MiniBatchKMeans (threshold={mbk_threshold:.4f}, derived from Hamming threshold {PHASH_DISTANCE_THRESHOLD}) ---")

    if not phashes_and_ids:
        print("No valid hashes generated, skipping clustering and deletion.")
        ids_to_delete = []
    else:
        # Prepare data for MiniBatchKMeans
        hashes_list = [p_id[0] for p_id in phashes_and_ids]
        ids_list = [p_id[1] for p_id in phashes_and_ids]
        # Convert ImageHash objects to NumPy float arrays (0.0/1.0) for MiniBatchKMeans
        hash_arrays = np.array([h.hash.flatten().astype(float) for h in hashes_list])

        # Apply MiniBatchKMeans
        # n_clusters is the desired number of clusters
        # batch_size controls how many samples are used in each iteration
        print("Running MiniBatchKMeans clustering...")
        mbk = MiniBatchKMeans(n_clusters=8, batch_size=1000, random_state=0)
        mbk.fit(hash_arrays)
        labels = mbk.labels_ # Get cluster labels for each point
        cluster_centers = mbk.cluster_centers_
        unique_labels = set(labels)
        print(f"MiniBatchKMeans finished. Found {len(unique_labels)} potential duplicate clusters (CF tree leaf nodes).")

        # Group IDs by cluster label
        clusters = defaultdict(list)
        for i, label in enumerate(labels):
            clusters[label].append(ids_list[i]) # Group original IDs by cluster label

        ids_to_delete = []
        can_check_metadata = bool(PG_METADATA_TABLE_NAME and PG_METADATA_FK_COLUMN_NAME)
        processed_clusters_count = 0

        # Process each cluster (leaf node) to decide which ID to keep
        print(f"Processing {len(clusters)} potential duplicate clusters to determine items for deletion...")
        for label, current_group_ids in clusters.items():
            # Only consider groups with more than 1 item as duplicates
            if len(current_group_ids) > 1:
                processed_clusters_count += 1
                keep_id = None
                # --- Keep ID selection logic (same as before) ---
                if can_check_metadata:
                    ids_with_meta = get_ids_with_metadata(pg_conn, current_group_ids)
                    if len(ids_with_meta) == 1:
                        keep_id = list(ids_with_meta)[0]
                    elif len(ids_with_meta) > 1:
                        potential_keeps_meta = [id_ for id_ in current_group_ids if id_ in ids_with_meta]
                        keep_id = min(potential_keeps_meta)

                if keep_id is None:
                    keep_id = min(current_group_ids)

                # Add others to delete list
                delete_ids_in_cluster = [id_ for id_ in current_group_ids if id_ != keep_id]
                ids_to_delete.extend(delete_ids_in_cluster)
                # Optional: print(f"  Cluster {label} (size {len(current_group_ids)}): Keeping {keep_id}, marked {len(delete_ids_in_cluster)} for deletion.")

        print(f"Finished processing {processed_clusters_count} clusters containing actual duplicates.")

    # --- Deletion Logic (Remains the same) ---
    print(f"\nTotal unique PostgreSQL IDs marked for deletion: {len(ids_to_delete)}")

    # 4. Delete Duplicates from PostgreSQL (No Confirmation Prompt)
    if not ids_to_delete:
        print("\nNo duplicate entries to delete.")
    else:
        if DRY_RUN:
            print("\n--- DRY RUN MODE ---")
            print(f"Would delete {len(ids_to_delete)} duplicate entries with the following IDs:")
            batch_size = 20
            # Sort for clearer output (optional)
            ids_to_delete.sort()
            for i in range(0, len(ids_to_delete), batch_size):
                print(f"  {ids_to_delete[i:i+batch_size]}")
            print("--- END DRY RUN ---")
        else:
            print("\n--- DELETING DUPLICATES (NO CONFIRMATION) ---")
            print(f"Proceeding to delete {len(ids_to_delete)} entries from '{PG_TABLE_NAME}'.")
            # Sort for potentially better locality if IDs are sequential (optional)
            ids_to_delete.sort()
            try:
                with pg_conn.cursor() as cur:
                    # Consider using DELETE ... WHERE id = ANY(%s) for batching if supported and efficient
                    # For now, stick to individual deletes with delay
                    delete_query = f"DELETE FROM {PG_TABLE_NAME} WHERE {PG_ID_COLUMN_NAME} = %s;"
                    for item_id in ids_to_delete:
                        try:
                            cur.execute(delete_query, (item_id,))
                            deleted_in_batch = cur.rowcount
                            total_deleted_count += deleted_in_batch
                            if deleted_in_batch > 0:
                                print(f"Deleted ID: {item_id} (Affected rows: {deleted_in_batch})")
                            else:
                                print(f"Warning: Delete command for ID {item_id} affected 0 rows (was it already deleted?).", file=sys.stderr)
                            if DELETE_DELAY_SECONDS > 0:
                                time.sleep(DELETE_DELAY_SECONDS)
                        except psycopg2.Error as delete_err:
                            print(f"Error deleting ID {item_id}: {delete_err}. Rolling back this attempt.", file=sys.stderr)
                            pg_conn.rollback() # Rollback individual delete, maybe continue? Or break? For now, just rollback and continue loop
                    pg_conn.commit() # Commit successful deletions at the end
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

    # 5. Report Final Results (Remains the same)
    print("\n--- Final Summary ---")
    print(f"Total PostgreSQL items processed: {total_pg_items}")
    if error_summary:
        total_errors = sum(error_summary.values())
        print(f"Failed or skipped items during hashing: {total_errors}")
        for reason, count in error_summary.most_common():
            print(f"  - {reason}: {count}")
    print(f"\nDuplicate instances identified via clustering: {len(ids_to_delete)}")
    if DRY_RUN:
        print(f"Action: DRY RUN - No entries were deleted.")
    elif total_deleted_count > 0:
        print(f"Action: DELETED {total_deleted_count} duplicate entries from PostgreSQL.")
    elif ids_to_delete:
        print(f"Action: Deletion attempted but 0 entries reported deleted (check logs/DB).")
    else:
        print(f"Action: No duplicates identified to delete.")
    if pg_conn:
        pg_conn.close()
        print("\nPostgreSQL connection closed.")

if __name__ == "__main__":
    process_duplicates()
    print("\n--- Script Finished ---")