#!/bin/bash

echo "============================================="
echo "  AI Plagiarism & Content Detector Platform  "
echo "============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
DB_NAME=${DB_NAME:-ai_plagiarism_detector}

# Kill processes on ports
echo -e "${YELLOW}Cleaning up ports...${NC}"
for PORT in $BACKEND_PORT $FRONTEND_PORT; do
  PID=$(lsof -ti :$PORT 2>/dev/null)
  if [ ! -z "$PID" ]; then
    echo -e "${RED}Killing process on port $PORT (PID: $PID)${NC}"
    kill -9 $PID 2>/dev/null
  fi
done

sleep 1

# Check PostgreSQL
echo -e "${CYAN}Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
  echo -e "${RED}PostgreSQL is not installed!${NC}"
  exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
  echo -e "${YELLOW}Starting PostgreSQL...${NC}"
  brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null
  sleep 2
fi

# Create database if not exists
echo -e "${CYAN}Setting up database...${NC}"
psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}Creating database: $DB_NAME${NC}"
  createdb "$DB_NAME" 2>/dev/null
fi

# Install dependencies
echo -e "${CYAN}Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  npm install
fi

if [ ! -d "client/node_modules" ]; then
  cd client && npm install && cd ..
fi

# Seed database
echo -e "${CYAN}Seeding database with sample data...${NC}"
node server/seed.js

# Start with hot reload
echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Starting Application with Hot Reload      ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo -e "${CYAN}  Backend:  http://localhost:$BACKEND_PORT${NC}"
echo -e "${CYAN}  Frontend: http://localhost:$FRONTEND_PORT${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${YELLOW}Demo Login:${NC}"
echo -e "  Email:    admin@university.edu"
echo -e "  Password: password123"
echo ""

# Start backend with nodemon (hot reload) and frontend concurrently
npx concurrently \
  --names "SERVER,CLIENT" \
  --prefix-colors "cyan,green" \
  "npx nodemon --watch server server/index.js" \
  "cd client && BROWSER=none PORT=$FRONTEND_PORT npm start"
