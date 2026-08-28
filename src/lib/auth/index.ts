import { requireAuth } from "@eazo/sdk/server";
import type { User } from "@eazo/sdk/server";

export { requireAuth };
export type { User, AuthResult } from "@eazo/sdk/server";

/**
 * 免登录场景：有会话就返回用户，没有/无效就返回 null，绝不抛错。
 * 用于分析等允许匿名的路由——登录后才云端持久化。
 */
export function getOptionalUser(request: Request): User | null {
  try {
    const auth = requireAuth(request);
    return auth.ok ? auth.user : null;
  } catch {
    return null;
  }
}
