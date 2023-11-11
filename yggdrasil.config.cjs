module.exports = {
    apps: [
        {
            name: 'lightquark',
            script: 'node dist/index.js',
            time: true,
            instances: 1, // TODO: Handle gateway clients list some other way to support multiple workers
            autorestart: true,
            max_restarts: 50,
            watch: false,
            max_memory_restart: '150M'
        },
    ],
    deploy: {
        production: {
            user: 'lightquark',
            host: process.env.TARGET_HOST || "10.0.2.6", // Provided by github actions
            ref: process.env.TARGET_BRANCH || "origin/dev",
            repo: 'https://github.com/LITdevs/Lightquark',
            path: '/home/lightquark/lightquark',
            'post-deploy':
                'yarn install && yarn build && pm2 reload yggdrasil.config.cjs --env production && pm2 save',
        },
    },
}