import { Sequelize } from 'sequelize'
import { env } from './environment.js'

const sqlOptions = {
  dialect: 'mssql',
  host: env.MSSQL_SERVER,
  port: env.MSSQL_PORT,
  logging: false,
  dialectOptions: {
    options: {
      encrypt: env.MSSQL_ENCRYPT,
      trustServerCertificate: env.MSSQL_TRUST_SERVER_CERTIFICATE,
      trustedConnection: env.MSSQL_INTEGRATED_SECURITY,
      connectTimeout: 10000,
      requestTimeout: 30000
    }
  }
}

const sequelize = env.MSSQL_INTEGRATED_SECURITY
  ? new Sequelize({ database: env.MSSQL_DATABASE, ...sqlOptions })
  : new Sequelize(env.MSSQL_DATABASE, env.MSSQL_USER, env.MSSQL_PASSWORD, sqlOptions)

export { sequelize }

export const connectSQL = async () => {
  await sequelize.authenticate()
  return true
}

export const closeSQL = async () => {
  await sequelize.close()
}
