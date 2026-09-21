/**
 * Configuration PM2 - Plateforme Aya (Production Hetzner CPX31)
 * 
 * Gestion de la haute disponibilité, surveillance mémoire, redémarrage automatique
 * et cloisonnement des environnements de production.
 */

module.exports = {
  apps: [
    {
      name: 'aya-platform',
      script: './server.js',
      cwd: __dirname,
      instances: 1, // Mode fork impératif : préserve les verrous de concurrence et le driveWorker autonome
      exec_mode: 'fork',
      autorestart: true,
      watch: false, // Ne pas surveiller les fichiers pour éviter les reloads lors de la génération vidéo/avatars
      max_memory_restart: '2G', // Redémarre proprement le worker si la mémoire dépasse 2 Go (protection fuites)
      restart_delay: 3000,
      kill_timeout: 5000, // 5 secondes de délai de grâce pour terminer les écritures de fichiers en cours
      listen_timeout: 10000,

      // Traçabilité & Gestion des logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,

      // Environnement par défaut (Développement / Local)
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        PYTHON_ENV: 'local',
        AYA_EXEC_PROFILE: 'local_high_perf'
      },

      // Environnement Production (VPS Hetzner Ubuntu 24.04 LTS)
      // Démarrage via : pm2 start ecosystem.config.js --env production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        PYTHON_ENV: 'production',
        AYA_EXEC_PROFILE: 'cloud_vps_safe'
      }
    }
  ]
};
