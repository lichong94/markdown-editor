// EXPORTS: store

/** 带项目命名空间的 localStorage 封装，读写均容错 */
const NS = 'markdown-editor';

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${NS}:${key}`);
      return raw !== null ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`${NS}:${key}`, JSON.stringify(value));
    } catch {
      /* 隐私模式静默降级 */
    }
  },
};
