#!/usr/bin/env bash

# Preliminary install script for a Debian 12 Proxmox LXC environment
# Author: vhsdream
set -euo pipefail

# Install deps
apt update && apt dist-upgrade -y
apt install -y --no-install-recommends \
    git \
    curl \
    sudo \
    zip \
    unzip \
    gnupg \
    postgresql-common

# Install Postrgres Repo & Postgres-17
echo "YES" | /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
apt install -y --no-install-recommends postgresql-17

# Configure Postgresql 17
DB_NAME="fluiddb"
DB_USER="fluiduser"
DB_PASS="$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | cut -c1-13)"
NEXTAUTH_SECRET="$(openssl rand -base64 44 | tr -dc 'a-zA-Z0-9' | cut -c1-32)"

sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME WITH OWNER $DB_USER ENCODING 'UTF8' TEMPLATE template0;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME to $DB_USER;"
sudo -u postgres psql -c "ALTER USER $DB_USER WITH SUPERUSER;"

# Add NodeJS repo and install v20
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
apt update && apt install -y nodejs

# tmp_file=$(mktemp)
RELEASE=$(curl -s https://api.github.com/repos/dotnetfactory/fluid-calendar/releases/latest | grep "tag_name" | awk '{print substr($2, 3, length($2)-4) }')
git clone https://github.com/dotnetfactory/fluid-calendar.git /opt/fluid-calendar
# wget -q "https://github.com/dotnetfactory/fluid-calendar/archive/refs/tags/v${RELEASE}.zip" -O $tmp_file
# unzip -q $tmp_file
# mv fluid-calendar-${RELEASE}/ /opt/fluid-calendar

# configure ENV file & cred for root
cat <<EOF >/opt/fluid-calendar/.env
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

# For OAuth integration with Google Calendar
# See https://console.cloud.google.com
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Change the URL below to your external URL
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# For optional Outlook Calendar Integration
# Create at https://portal.azure.com
AZURE_AD_CLIENT_ID=""
AZURE_AD_CLIENT_SECRET=""
AZURE_AD_TENANT_ID=""

# Logging configuration
# Options: debug, none (check logger.js for more details)
LOG_LEVEL="none"
DEBUG_ENABLED=0
EOF

cat <<EOF >/root/.creds
Postgresql DB Name: ${DB_NAME}
DB User: ${DB_USER}
DB Password: ${DB_PASS}
NextAuth Secret: ${NEXTAUTH_SECRET}
EOF

# Install Node deps, generate prisma thing and migrate database
cd /opt/fluid-calendar
export NEXT_TELEMETRY_DISABLED=1
npm run setup

# Build app
npm run build

# Create service file
cat <<EOF >/etc/systemd/system/fluid-calendar.service
[Unit]
Description=Fluid Calendar Application
After=network.target postgresql.service

[Service]
Restart=always
WorkingDirectory=/opt/fluid-calendar
ExecStart=/usr/bin/npm run start

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl -q enable --now fluid-calendar.service

# Clean up
apt autoclean -y && apt autoremove -y
# rm -rf $tmp_file
echo "Done."
