// 数据库层：MySQL（微信云托管自带 MySQL / CynosDB，utf8mb4）
// 连接池常驻防冷启动；无 MYSQL_HOST 时回退内存库（本地脚手架/开发用）。
const mysql = require("mysql2/promise");

const CFG = {
  host: process.env.MYSQL_HOST || "",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DB || "structure_lens",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 5,
  connectTimeout: 6000,
};

let pool = null;

function mysqlEnabled() {
  return Boolean(CFG.host);
}

function getPool() {
  if (!pool) pool = mysql.createPool(CFG);
  return pool;
}

/** 执行一条 SQL；连接失败抛错由调用方兜底。 */
async function query(sql, params) {
  if (!mysqlEnabled()) throw new Error("mysql not configured");
  return getPool().query(sql, params || []);
}

/** 健康探测：SELECT 1，失败抛错。 */
async function ping() {
  const [rows] = await query("SELECT 1 AS ok");
  return rows && rows[0] && rows[0].ok === 1;
}

/** 心跳保活：每 4 分钟跑一次，防止服务端自动休眠把连接杀光。 */
let heartbeatTimer = null;
function startHeartbeat() {
  if (heartbeatTimer || !mysqlEnabled()) return;
  heartbeatTimer = setInterval(() => {
    ping().catch(() => {});
  }, 4 * 60 * 1000);
  heartbeatTimer.unref && heartbeatTimer.unref();
}

module.exports = { mysqlEnabled, getPool, query, ping, startHeartbeat };
