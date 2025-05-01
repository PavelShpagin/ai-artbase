import psycopg2
import chromadb
import os
import sys
from urllib.parse import urlparse
import concurrent.futures # Keep for potential future use, though not strictly needed for this version

# --- Configuration from Environment Variables ---
# PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL")
PG_TABLE_NAME = os.getenv("PG_TABLE_NAME", "arts") # Default to 'arts'
PG_ID_COLUMN_NAME = os.getenv("PG_ID_COLUMN_NAME", "id") # Default to 'id'

# ChromaDB Configuration
CHROMA_HOST = os.getenv("CHROMA_HOST", "chromadb") # Default ChromaDB service name
CHROMA_PORT = os.getenv("CHROMA_PORT", "8001")
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "Prompts") # Default collection name

# --- Script Configuration ---
# Batch size for fetching ChromaDB IDs (adjust based on memory/performance)
CHROMA_FETCH_BATCH_SIZE = int(os.getenv("CHROMA_FETCH_BATCH_SIZE", 10000))

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

def fetch_all_pg_ids(conn, table_name, id_column):
    """Fetches all unique IDs from the specified PostgreSQL table column."""
    pg_ids = set()
    print(f"Fetching all IDs from PostgreSQL table '{table_name}', column '{id_column}'...")
    try:
        with conn.cursor() as cur:
            query = f"SELECT DISTINCT {id_column} FROM {table_name} WHERE {id_column} IS NOT NULL;"
            cur.execute(query)
            count = 0
            while True:
                results = cur.fetchmany(5000) # Fetch in chunks
                if not results:
                    break
                # Convert all IDs to strings for consistent comparison with ChromaDB
                pg_ids.update(str(row[0]) for row in results)
                count += len(results)
                if count % 50000 == 0: # Progress update for large tables
                     print(f"  Fetched {count} PostgreSQL IDs so far...")
            print(f"Fetched a total of {len(pg_ids)} unique IDs from PostgreSQL.")
    except psycopg2.Error as e:
        print(f"PostgreSQL error fetching IDs: {e}", file=sys.stderr)
        raise # Reraise as this is critical
    return pg_ids

def fetch_all_chroma_ids(chroma_client, collection_name, batch_size):
    """Fetches all IDs from the specified ChromaDB collection."""
    chroma_ids = set()
    print(f"Fetching all IDs from ChromaDB collection '{collection_name}'...")
    try:
        collection = chroma_client.get_collection(name=collection_name)
        total_count = collection.count()
        print(f"  Collection '{collection_name}' has approximately {total_count} entries.")

        if total_count == 0:
             print("  ChromaDB collection is empty.")
             return chroma_ids

        fetched_count = 0
        offset = 0
        while fetched_count < total_count:
            # Fetch only IDs (include=[]) is efficient
            results = collection.get(limit=batch_size, offset=offset, include=[])
            batch_ids = results.get('ids', [])
            if not batch_ids:
                # Should not happen if offset < total_count, but safety check
                print(f"  Warning: Received empty batch from ChromaDB at offset {offset}", file=sys.stderr)
                break

            chroma_ids.update(batch_ids) # Chroma IDs are already strings
            fetched_count += len(batch_ids)
            offset += len(batch_ids) # Increment offset correctly

            # Check if we somehow fetched more than expected or got stuck
            if not batch_ids and fetched_count < total_count:
                 print(f"  Warning: ChromaDB fetch stopped prematurely at {fetched_count}/{total_count} IDs.", file=sys.stderr)
                 break
            if fetched_count % (batch_size * 5) == 0 or fetched_count == total_count: # Progress update
                print(f"  Fetched {fetched_count}/{total_count} ChromaDB IDs...")


        print(f"Fetched a total of {len(chroma_ids)} unique IDs from ChromaDB.")
        if len(chroma_ids) != total_count:
             print(f"  Warning: Final fetched count ({len(chroma_ids)}) differs from initial reported count ({total_count}). Using fetched count.", file=sys.stderr)

    except chromadb.errors.CollectionNotFoundError:
         print(f"CRITICAL: ChromaDB collection '{collection_name}' not found.", file=sys.stderr)
         raise
    except Exception as e:
        print(f"ChromaDB error fetching IDs: {e}", file=sys.stderr)
        raise # Reraise as this is critical
    return chroma_ids

# --- Main Execution ---

def find_orphaned_chroma_entries():
    pg_conn = None
    chroma_client = None

    # 1. Connect to PostgreSQL
    pg_connection_params = parse_database_url(DATABASE_URL)
    if not pg_connection_params:
        print("CRITICAL: DATABASE_URL is missing or invalid. Cannot connect to PostgreSQL.", file=sys.stderr)
        sys.exit(1)

    print(f"\nAttempting PostgreSQL connection to host '{pg_connection_params.get('host')}'...")
    try:
        pg_conn = psycopg2.connect(**pg_connection_params)
        print("PostgreSQL connection successful.")
    except psycopg2.OperationalError as e:
        print(f"CRITICAL: Failed to connect to PostgreSQL: {e}", file=sys.stderr)
        sys.exit(1)

    # 2. Fetch PostgreSQL IDs
    try:
        pg_ids_set = fetch_all_pg_ids(pg_conn, PG_TABLE_NAME, PG_ID_COLUMN_NAME)
    except Exception as e:
        print(f"CRITICAL: Failed to fetch IDs from PostgreSQL. Error: {e}", file=sys.stderr)
        if pg_conn: pg_conn.close()
        sys.exit(1)

    # 3. Connect to ChromaDB
    print(f"\nAttempting ChromaDB connection to host '{CHROMA_HOST}:{CHROMA_PORT}'...")
    try:
        chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        chroma_client.heartbeat() # Test connection
        print("ChromaDB connection successful.")
    except Exception as e:
        print(f"CRITICAL: Failed to connect to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}. Error: {e}", file=sys.stderr)
        if pg_conn: pg_conn.close()
        sys.exit(1)

    # 4. Fetch ChromaDB IDs
    try:
        chroma_ids_set = fetch_all_chroma_ids(chroma_client, CHROMA_COLLECTION_NAME, CHROMA_FETCH_BATCH_SIZE)
    except Exception as e:
        print(f"CRITICAL: Failed to fetch IDs from ChromaDB. Error: {e}", file=sys.stderr)
        if pg_conn: pg_conn.close()
        sys.exit(1)

    # 5. Compare Sets and Count Orphans
    print("\nComparing PostgreSQL and ChromaDB ID sets...")
    orphaned_chroma_ids = []
    if not chroma_ids_set:
        print("ChromaDB collection is empty or IDs could not be fetched. No orphans found.")
        orphaned_count = 0
    else:
        # Find IDs in ChromaDB that are NOT in PostgreSQL
        orphaned_chroma_ids = list(chroma_ids_set - pg_ids_set) # Set difference
        orphaned_count = len(orphaned_chroma_ids)
        print(f"Comparison complete.")

    # 6. Report Results
    print("\n--- Final Summary ---")
    print(f"Unique IDs found in PostgreSQL ('{PG_TABLE_NAME}'.'{PG_ID_COLUMN_NAME}'): {len(pg_ids_set)}")
    print(f"Unique IDs found in ChromaDB ('{CHROMA_COLLECTION_NAME}'): {len(chroma_ids_set)}")
    print(f"\nNumber of ChromaDB IDs NOT found in PostgreSQL (orphans): {orphaned_count}")

    # Optional: List orphaned IDs if needed (can be long)
    if orphaned_count > 0 and orphaned_count <= 50: # Print only if the list is reasonably short
        print("Orphaned ChromaDB IDs:")
        for orphan_id in orphaned_chroma_ids:
             print(f"  - {orphan_id}")
    elif orphaned_count > 50:
        print("(List of orphaned IDs is too long to display)")


    # 7. Cleanup
    if pg_conn:
        pg_conn.close()
        print("\nPostgreSQL connection closed.")

if __name__ == "__main__":
    find_orphaned_chroma_entries()
    print("\n--- Script Finished ---")
