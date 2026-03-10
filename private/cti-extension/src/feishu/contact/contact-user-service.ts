import type { FeishuContactUser } from '../domain/contact-user.js';

export interface ContactUserLookupRequest {
  params?: {
    department_id_type?: 'department_id' | 'open_department_id';
    user_id_type?: 'open_id' | 'union_id' | 'user_id';
  };
  path: {
    user_id: string;
  };
}

export interface ContactUserLookupClient {
  contact?: {
    v3?: {
      user?: {
        get(
          payload: ContactUserLookupRequest,
        ): Promise<{
          code?: number;
          data?: {
            user?: FeishuContactUser;
          };
          msg?: string;
        }>;
      };
    };
  };
}

export interface ContactUserServiceOptions {
  debugLog?: (message: string, details?: Record<string, unknown>) => void;
  logger?: Pick<Console, 'warn'>;
  restClient: ContactUserLookupClient | null;
}

export class ContactUserService {
  private readonly debugLog?: (message: string, details?: Record<string, unknown>) => void;
  private readonly logger: Pick<Console, 'warn'>;
  private readonly restClient: ContactUserLookupClient | null;

  constructor(options: ContactUserServiceOptions) {
    this.debugLog = options.debugLog;
    this.logger = options.logger ?? console;
    this.restClient = options.restClient;
  }

  async getByOpenId(openId: string): Promise<FeishuContactUser | null> {
    const normalizedOpenId = openId.trim();
    if (!normalizedOpenId) {
      this.debugLog?.('contact user lookup skipped because open_id is missing');
      return null;
    }

    const contactUserApi = this.restClient?.contact?.v3?.user?.get;
    if (typeof contactUserApi !== 'function') {
      this.debugLog?.('contact user lookup skipped because contact API client is unavailable');
      return null;
    }

    try {
      const response = await contactUserApi({
        path: {
          user_id: normalizedOpenId,
        },
        params: {
          user_id_type: 'open_id',
        },
      });

      if (response.code && response.code !== 0) {
        this.logger.warn(
          `[cti-extension] Contact user lookup failed for open_id ${normalizedOpenId}: ${response.msg ?? 'unknown error'}`,
        );
        this.debugLog?.('contact user lookup returned non-zero response code', {
          code: response.code,
          msg: response.msg ?? null,
          open_id: normalizedOpenId,
        });
        return null;
      }

      const user = response.data?.user ?? null;
      this.debugLog?.('contact user lookup completed', {
        found_user: !!user,
        open_id: normalizedOpenId,
      });
      return user;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[cti-extension] Contact user lookup failed for open_id ${normalizedOpenId}: ${reason}`);
      this.debugLog?.('contact user lookup threw an error', {
        error: reason,
        open_id: normalizedOpenId,
      });
      return null;
    }
  }
}
