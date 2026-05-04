const encode = (value) => encodeURIComponent(value ?? '');

export const buildDatabaseUrl = ({
  databaseUrl,
  mysqlHost,
  mysqlPort,
  mysqlDatabase,
  mysqlUser,
  mysqlPassword,
  mysqlSsl,
}) => {
  if (databaseUrl) {
    return databaseUrl;
  }

  const host = mysqlHost || '127.0.0.1';
  const port = Number(mysqlPort) || 3306;
  const database = mysqlDatabase || 'meeting_service';
  const user = mysqlUser || 'root';
  const password = mysqlPassword || '';
  const base = `mysql://${encode(user)}:${encode(password)}@${host}:${port}/${database}`;

  if (!mysqlSsl) {
    return base;
  }

  const sslMode = String(mysqlSsl).toLowerCase();
  if (['0', 'false', 'off', 'disable', 'disabled'].includes(sslMode)) {
    return base;
  }

  return `${base}?sslaccept=${encode(mysqlSsl)}`;
};
