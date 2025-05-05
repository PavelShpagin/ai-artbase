#!/bin/bash
docker exec -it aiartbase-backend sh
alembic revision --autogenerate -m "$1"
alembic upgrade head
exit
docker cp aiartbase-backend:/app/alembic/versions $(pwd)/backend/alembic

docker exec -it aiartbase-db psql -U postgres -d artbase -c "UPDATE arts SET is_generated = false, is_public = true;"