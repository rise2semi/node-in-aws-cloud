module.exports = {
    db: {
        client: 'pg',
        connection: {
            host: process.env.DB_HOSTNAME,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            port: '5432',
            database: process.env.DB_DBNAME,
        },
        pool: {
            min: 1,
            max: 2
        }
    }
}
