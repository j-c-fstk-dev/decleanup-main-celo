/**
 * PM2 Ecosystem Configuration for DeCleanup Frontend
 * 
 * Usage:
 *   pm2 delete decleanup
 *   pm2 start ecosystem.config.js
 *   pm2 save
 */

module.exports = {
  apps: [{
    name: 'decleanup',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/decleanup/frontend',
    interpreter: 'none',
    
    // Environment variables
    // Note: PM2 will also read from .env.local if it exists
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      
      // Blockchain Configuration
      NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '11142220',
      NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org',
      NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://forno.celo-sepolia.celo-testnet.org',
      NEXT_PUBLIC_BLOCK_EXPLORER_URL: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://celo-sepolia.blockscout.com',
      
      // Contract Addresses (set these in .env.local)
      // NEXT_PUBLIC_SUBMISSION_CONTRACT: process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT,
      // NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT,
      // NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT: process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT,
      
      // IPFS Configuration
      NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
      NEXT_PUBLIC_IMPACT_IMAGES_CID: process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y',
      
      // App Configuration
      NEXT_PUBLIC_MINIAPP_URL: process.env.NEXT_PUBLIC_MINIAPP_URL || 'http://207.180.203.243:3000',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://207.180.203.243:3000',
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64',
      
      // ML Verification / GPU Service
      ML_VERIFICATION_ENABLED: process.env.ML_VERIFICATION_ENABLED || 'true',
      GPU_INFERENCE_SERVICE_URL: process.env.GPU_INFERENCE_SERVICE_URL || 'http://207.180.203.243:8000',
      GPU_SHARED_SECRET: process.env.GPU_SHARED_SECRET || '',
      
      // File Upload Configuration
      UPLOAD_DIR: process.env.UPLOAD_DIR || '/var/www/decleanup/uploads',
      PUBLIC_URL_BASE: process.env.PUBLIC_URL_BASE || 'http://207.180.203.243:3000',
    },
    
    // Process management
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,
    max_memory_restart: '1G',
    
    // Logging
    error_file: '/var/www/decleanup/logs/pm2-error.log',
    out_file: '/var/www/decleanup/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Advanced
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
  }]
}
