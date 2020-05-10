import chalk from 'chalk'
import winston from 'winston'

export const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  winstonLogger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  )
}

export const logger = (level: LogLevel, stage: string, msg: string) => {
  winstonLogger.log(
    level,
    `${chalk.blueBright(stage + ':')} ${chalk.yellow(msg)}`
  )
}

type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'sill'
