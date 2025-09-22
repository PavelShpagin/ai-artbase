docker run --rm \
      -v ai-artbase_pgdata:/target_volume \
      -v "$(pwd)/backend/postgres_data":/source_data:ro \
      alpine \
      sh -c 'cp -a /source_data/. /target_volume/ && echo "Copy potentially complete!"'

docker run --rm -it \
    -v ai-artbase_pgdata:/mnt/data \
    alpine \
    sh

cd /mnt/data