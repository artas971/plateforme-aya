# Dockerfile - Aya Platform Subtitling Pipeline V3 & Full-Stack Server
FROM python:3.10-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    WHISPER_BACKEND=local \
    WHISPER_MODEL=base \
    PORT=3000

# 1. Dépendances système : FFmpeg avec libass, fontconfig, curl, gpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libass-dev \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    curl \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# 2. Installation de Node.js 20 LTS (nécessaire pour exécuter server.js)
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# 3. Installation des polices officielles Impact & Arial Black pour libass
RUN mkdir -p /usr/share/fonts/truetype/custom
COPY fonts/ /usr/share/fonts/truetype/custom/
RUN fc-cache -f -v && fc-list : family | grep -iq "Impact" && echo "✅ Police Impact correctement installée et reconnue par fontconfig."

# Répertoire applicatif
WORKDIR /app

# 4. Installation des dépendances Node.js
COPY package*.json /app/
RUN npm install --production

# 5. Installation des dépendances Python
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 6. Pré-téléchargement au BUILD du modèle faster-whisper (Zéro download au runtime)
RUN python -c "from faster_whisper import WhisperModel; print('Pré-téléchargement modèle faster-whisper base...'); WhisperModel('base', device='cpu', compute_type='int8')"

# 7. Copie de l'intégralité du code source
COPY . /app

# Exposition du port web Node.js Express
EXPOSE 3000

# Commande de démarrage universelle
CMD ["node", "server.js"]
