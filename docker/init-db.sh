#!/bin/bash
set -e

# Create the test database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE fyren_test;
    GRANT ALL PRIVILEGES ON DATABASE fyren_test TO $POSTGRES_USER;
EOSQL

echo "Test database 'fyren_test' created successfully"
