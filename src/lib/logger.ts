type Level = 'debug' | 'info' | 'warn' | 'error';

type Fields = Record<string, unknown>;

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): Level {
  const level = process.env.LOG_LEVEL as Level | undefined;
  return level && level in LEVEL_WEIGHT ? level : 'info';
}

// Nao importa config/env para que o logger funcione mesmo se a configuracao falhar ao carregar
const minWeight = LEVEL_WEIGHT[configuredLevel()];
const jsonOutput = process.env.NODE_ENV === 'production';

function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}

function serializeFields(fields: Fields): Fields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value instanceof Error ? serializeError(value) : value]),
  );
}

function write(level: Level, message: string, fields: Fields = {}): void {
  if (LEVEL_WEIGHT[level] < minWeight) {
    return;
  }

  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  const data = serializeFields(fields);

  if (jsonOutput) {
    // Uma linha JSON por evento: o Railway indexa "level" e os demais campos para filtro
    stream.write(`${JSON.stringify({ level, message, time: new Date().toISOString(), ...data })}\n`);
    return;
  }

  const extra = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
  stream.write(`[${level}] ${message}${extra}\n`);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write('debug', message, fields),
  info: (message: string, fields?: Fields) => write('info', message, fields),
  warn: (message: string, fields?: Fields) => write('warn', message, fields),
  error: (message: string, fields?: Fields) => write('error', message, fields),
};
