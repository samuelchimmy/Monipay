#!/bin/bash
set -e

echo "Starting VM setup for Bots..."

# Update and install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Install Node.js 20 LTS
if ! command -v node &> /dev/null
then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null
then
    echo "Installing PM2..."
    sudo npm install pm2@latest -g
fi

# Create a directory for bots
mkdir -p ~/bots
cd ~/bots

REPOS=(
    "https://github.com/samuelchimmy/monibot-vp-social.git"
    "https://github.com/samuelchimmy/monibot.git"
    "https://github.com/samuelchimmy/monibot-discord.git"
    "https://github.com/samuelchimmy/monibot-telegram.git"
    "https://github.com/samuelchimmy/xter.git"
)

for REPO in "${REPOS[@]}"; do
    # Extract the repo name from the URL
    REPO_NAME=$(basename -s .git "$REPO")
    
    echo "==================================="
    echo "Setting up $REPO_NAME..."
    echo "==================================="
    
    # Clone the repo if it doesn't exist
    if [ ! -d "$REPO_NAME" ]; then
        git clone "$REPO" || { echo "Failed to clone $REPO_NAME. You might need a Personal Access Token if it is private."; continue; }
    else
        echo "$REPO_NAME already exists. Pulling latest..."
        cd "$REPO_NAME"
        git pull
        cd ..
    fi

    # Go into the directory
    cd "$REPO_NAME"

    # Install Node.js dependencies
    if [ -f "package.json" ]; then
        echo "Installing npm dependencies for $REPO_NAME..."
        npm install
        
        # Check if it needs a build step
        if grep -q '"build":' package.json; then
            echo "Running build step..."
            npm run build
        fi
    fi

    # Python dependencies fallback
    if [ -f "requirements.txt" ]; then
        echo "Installing Python dependencies..."
        sudo apt install -y python3-pip python3-venv
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        deactivate
    fi

    echo "---"
    echo "IMPORTANT: You need to configure .env for $REPO_NAME before starting!"
    echo "---"
    
    cd ~/bots
done

echo ""
echo "Setup complete!"
echo "Next Steps:"
echo "1. Go into each bot directory: cd ~/bots/<bot-name>"
echo "2. Create the environment file: nano .env (NEVER commit this file to GitHub!)"
echo "3. Start the bot (Node example): pm2 start index.js --name \"<bot-name>\""
echo "4. Once all bots are running, save PM2 state: pm2 save && pm2 startup"
