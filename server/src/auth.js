// 认证：OPEN 云托管 callContainer 自动注入 x-wx-openid 请求头。
// getOptionalUser = 免登录可用（分析链路/行动/分享）；requireUser = 必须有 openid（地图同步/用户档案）。

const OPENID_HEADER = "x-wx-openid";

/** 读取当前用户 openid；无则返回 null（不 401，用于免登录链路）。 */
function getOptionalUser(req) {
  const openid = String(req.headers[OPENID_HEADER] || "").trim();
  if (!openid) return null;
  return { id: openid, email: undefined, name: undefined, avatarUrl: undefined };
}

/**
 * 需要登录的接口：无 openid 时回 401 {error:"login_required"} 并返回 null。
 * 调用方：`const user = requireUser(req, res); if (!user) return;`
 */
function requireUser(req, res) {
  const user = getOptionalUser(req);
  if (!user) {
    res.status(401).json({ error: "login_required" });
    return null;
  }
  return user;
}

/** 从 header 读原始 openid 字符串（供排错/日志，通常不直接用） */
function rawOpenid(req) {
  return String(req.headers[OPENID_HEADER] || "").trim();
}

module.exports = { getOptionalUser, requireUser, rawOpenid, OPENID_HEADER };