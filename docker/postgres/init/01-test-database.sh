#!/bin/sh
# Runs once, when the volume is created: adds the test database next to the dev one.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
	CREATE DATABASE ${TEST_DATABASE} OWNER ${POSTGRES_USER};
SQL
