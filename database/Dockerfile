# PostgreSQL + PostGIS + pgRouting
FROM postgis/postgis:15-3.4

# Install dependencies for pgRouting
RUN apt-get update && \
    apt-get install -y \
    postgresql-15-pgrouting \
    postgresql-15-pgrouting-scripts && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV POSTGRES_DB=postgres
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres

# Expose PostgreSQL port
EXPOSE 5432
