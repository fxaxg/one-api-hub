import { Storage } from "@plasmohq/storage";
import { refreshAccountData } from './apiService';
import type { 
  SiteAccount, 
  StorageConfig, 
  AccountStats, 
  DisplaySiteData,
  CurrencyType,
  SiteHealthStatus 
} from "../types";

// 存储键名常量
const STORAGE_KEYS = {
  ACCOUNTS: 'site_accounts',
  CONFIG: 'storage_config'
} as const;

// 默认配置
const DEFAULT_CONFIG: StorageConfig = {
  accounts: [],
  last_updated: Date.now()
};

class AccountStorageService {
  private storage: Storage;

  constructor() {
    this.storage = new Storage({
      area: "local"
    });
  }

  /**
   * 获取所有账号信息
   */
  async getAllAccounts(): Promise<SiteAccount[]> {
    try {
      const config = await this.getStorageConfig();
      return config.accounts;
    } catch (error) {
      console.error('获取账号信息失败:', error);
      return [];
    }
  }

  /**
   * 根据 ID 获取单个账号信息
   */
  async getAccountById(id: string): Promise<SiteAccount | null> {
    try {
      const accounts = await this.getAllAccounts();
      return accounts.find(account => account.id === id) || null;
    } catch (error) {
      console.error('获取账号信息失败:', error);
      return null;
    }
  }

  /**
   * 检查给定 URL 是否已存在
   */
  async checkUrlExists(url: string): Promise<SiteAccount | null> {
    if (!url) return null;
    try {
      const currentUrl = new URL(url);
      const accounts = await this.getAllAccounts();
      
      return accounts.find(account => {
        try {
          const accountUrl = new URL(account.site_url);
          return accountUrl.origin === currentUrl.origin;
        } catch {
          return false;
        }
      }) || null;
    } catch (error) {
      console.error('检查 URL 是否存在时出错:', error);
      return null;
    }
  }

  /**
   * 添加新账号
   */
  async addAccount(accountData: Omit<SiteAccount, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      console.log('[AccountStorage] 开始添加新账号:', accountData.site_name);
      const accounts = await this.getAllAccounts();
      console.log('[AccountStorage] 当前账号数量:', accounts.length);
      
      const now = Date.now();
      const newAccount: SiteAccount = {
        ...accountData,
        id: this.generateId(),
        created_at: now,
        updated_at: now
      };

      accounts.push(newAccount);
      console.log('[AccountStorage] 准备保存账号，总数量:', accounts.length);
      await this.saveAccounts(accounts);
      console.log('[AccountStorage] 账号保存成功，ID:', newAccount.id);
      
      return newAccount.id;
    } catch (error) {
      console.error('[AccountStorage] 添加账号失败:', error);
      throw error;
    }
  }

  /**
   * 更新账号信息
   */
  async updateAccount(id: string, updates: Partial<Omit<SiteAccount, 'id' | 'created_at'>>): Promise<boolean> {
    try {
      const accounts = await this.getAllAccounts();
      const index = accounts.findIndex(account => account.id === id);
      
      if (index === -1) {
        throw new Error(`账号 ${id} 不存在`);
      }

      accounts[index] = {
        ...accounts[index],
        ...updates,
        updated_at: Date.now()
      };

      await this.saveAccounts(accounts);
      return true;
    } catch (error) {
      console.error('更新账号失败:', error);
      return false;
    }
  }

  /**
   * 删除账号
   */
  async deleteAccount(id: string): Promise<boolean> {
    try {
      const accounts = await this.getAllAccounts();
      const filteredAccounts = accounts.filter(account => account.id !== id);
      
      if (filteredAccounts.length === accounts.length) {
        console.error(`账号 ${id} 不存在，当前账号列表:`, accounts.map(acc => ({ id: acc.id, name: acc.site_name })));
        throw new Error(`账号 ${id} 不存在`);
      }

      await this.saveAccounts(filteredAccounts);
      return true;
    } catch (error) {
      console.error('删除账号失败:', error);
      throw error; // 重新抛出错误，让调用者处理
    }
  }

  /**
   * 更新账号同步时间
   */
  async updateSyncTime(id: string): Promise<boolean> {
    return this.updateAccount(id, { 
      last_sync_time: Date.now(),
      updated_at: Date.now()
    });
  }

  /**
   * 刷新单个账号数据
   */
  async refreshAccount(id: string): Promise<boolean> {
    try {
      const account = await this.getAccountById(id);
      if (!account) {
        throw new Error(`账号 ${id} 不存在`);
      }

      // 使用同步导入的API服务
      const result = await refreshAccountData(
        account.site_url,
        account.account_info.id,
        account.account_info.access_token
      );

      // 构建更新数据
      const updateData: Partial<Omit<SiteAccount, 'id' | 'created_at'>> = {
        health_status: result.healthStatus.status,
        last_sync_time: Date.now()
      };

      // 如果成功获取数据，更新账号信息
      if (result.success && result.data) {
        updateData.account_info = {
          ...account.account_info,
          quota: result.data.quota,
          today_prompt_tokens: result.data.today_prompt_tokens,
          today_completion_tokens: result.data.today_completion_tokens,
          today_quota_consumption: result.data.today_quota_consumption,
          today_requests_count: result.data.today_requests_count
        };
      }

      // 更新账号信息
      const updateSuccess = await this.updateAccount(id, updateData);
      
      // 记录健康状态变化
      if (account.health_status !== result.healthStatus.status) {
        console.log(`账号 ${account.site_name} 健康状态变化: ${account.health_status} -> ${result.healthStatus.status}`);
        console.log(`状态详情: ${result.healthStatus.message}`);
      }

      return updateSuccess;
    } catch (error) {
      console.error('刷新账号数据失败:', error);
      // 在出现异常时也尝试更新健康状态为unknown
      try {
        await this.updateAccount(id, {
          health_status: 'unknown',
          last_sync_time: Date.now()
        });
      } catch (updateError) {
        console.error('更新健康状态失败:', updateError);
      }
      return false;
    }
  }

  /**
   * 刷新所有账号数据
   */
  async refreshAllAccounts(): Promise<{ success: number; failed: number }> {
    const accounts = await this.getAllAccounts();
    let success = 0;
    let failed = 0;

    // 使用 Promise.allSettled 来并发刷新，避免单个失败影响其他账号
    const results = await Promise.allSettled(
      accounts.map(account => this.refreshAccount(account.id))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        success++;
      } else {
        failed++;
        console.error(`刷新账号 ${accounts[index].site_name} 失败:`, 
          result.status === 'rejected' ? result.reason : '未知错误');
      }
    });

    return { success, failed };
  }

  /**
   * 计算账号统计信息
   */
  async getAccountStats(): Promise<AccountStats> {
    try {
      const accounts = await this.getAllAccounts();
      
      return accounts.reduce((stats, account) => ({
        total_quota: stats.total_quota + account.account_info.quota,
        today_total_consumption: stats.today_total_consumption + account.account_info.today_quota_consumption,
        today_total_requests: stats.today_total_requests + account.account_info.today_requests_count,
        today_total_prompt_tokens: stats.today_total_prompt_tokens + account.account_info.today_prompt_tokens,
        today_total_completion_tokens: stats.today_total_completion_tokens + account.account_info.today_completion_tokens,
      }), {
        total_quota: 0,
        today_total_consumption: 0,
        today_total_requests: 0,
        today_total_prompt_tokens: 0,
        today_total_completion_tokens: 0,
      });
    } catch (error) {
      console.error('计算统计信息失败:', error);
      return {
        total_quota: 0,
        today_total_consumption: 0,
        today_total_requests: 0,
        today_total_prompt_tokens: 0,
        today_total_completion_tokens: 0,
      };
    }
  }

  /**
   * 转换为展示用的数据格式 (兼容当前 UI)
   */
  convertToDisplayData(accounts: SiteAccount[]): DisplaySiteData[] {
    return accounts.map(account => ({
      id: account.id,
      icon: account.emoji,
      name: account.site_name,
      username: account.account_info.username,
      balance: {
        USD: parseFloat((account.account_info.quota / 500000).toFixed(2)),
        CNY: parseFloat(((account.account_info.quota / 500000) * account.exchange_rate).toFixed(2))
      },
      todayConsumption: {
        USD: parseFloat((account.account_info.today_quota_consumption / 500000).toFixed(2)),
        CNY: parseFloat(((account.account_info.today_quota_consumption / 500000) * account.exchange_rate).toFixed(2))
      },
      todayTokens: {
        upload: account.account_info.today_prompt_tokens,
        download: account.account_info.today_completion_tokens
      },
      healthStatus: account.health_status,
      baseUrl: account.site_url,
      token: account.account_info.access_token,
      userId: account.account_info.id // 添加真实的用户 ID
    }));
  }

  /**
   * 清空所有数据
   */
  async clearAllData(): Promise<boolean> {
    try {
      await this.storage.remove(STORAGE_KEYS.ACCOUNTS);
      await this.storage.remove(STORAGE_KEYS.CONFIG);
      return true;
    } catch (error) {
      console.error('清空数据失败:', error);
      return false;
    }
  }

  /**
   * 导出数据
   */
  async exportData(): Promise<StorageConfig> {
    return this.getStorageConfig();
  }

  /**
   * 导入数据
   */
  async importData(data: StorageConfig): Promise<boolean> {
    try {
      await this.storage.set(STORAGE_KEYS.ACCOUNTS, {
        ...data,
        last_updated: Date.now()
      });
      return true;
    } catch (error) {
      console.error('导入数据失败:', error);
      return false;
    }
  }

  // 私有方法

  /**
   * 获取存储配置
   */
  private async getStorageConfig(): Promise<StorageConfig> {
    try {
      const config = await this.storage.get(STORAGE_KEYS.ACCOUNTS) as StorageConfig;
      return config || DEFAULT_CONFIG;
    } catch (error) {
      console.error('获取存储配置失败:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * 保存账号数据
   */
  private async saveAccounts(accounts: SiteAccount[]): Promise<void> {
    console.log('[AccountStorage] 开始保存账号数据，数量:', accounts.length);
    const config: StorageConfig = {
      accounts,
      last_updated: Date.now()
    };
    
    console.log('[AccountStorage] 保存的配置数据:', { 
      accountCount: config.accounts.length,
      last_updated: config.last_updated,
      storageKey: STORAGE_KEYS.ACCOUNTS
    });
    
    await this.storage.set(STORAGE_KEYS.ACCOUNTS, config);
    console.log('[AccountStorage] 账号数据保存完成');
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `account_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// 创建单例实例
export const accountStorage = new AccountStorageService();

// 工具函数
export const AccountStorageUtils = {
  /**
   * 格式化余额显示
   */
  formatBalance(amount: number, currency: CurrencyType): string {
    const symbol = currency === 'USD' ? '$' : '¥';
    return `${symbol}${amount.toFixed(2)}`;
  },

  /**
   * 格式化 token 数量
   */
  formatTokenCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  },

  /**
   * 验证账号数据
   */
  validateAccount(account: Partial<SiteAccount>): string[] {
    const errors: string[] = [];

    if (!account.site_name?.trim()) {
      errors.push('站点名称不能为空');
    }

    if (!account.site_url?.trim()) {
      errors.push('站点 URL 不能为空');
    }

    if (!account.account_info?.access_token?.trim()) {
      errors.push('访问令牌不能为空');
    }

    if (!account.account_info?.username?.trim()) {
      errors.push('用户名不能为空');
    }

    if (!account.health_status) {
      errors.push('站点健康状态不能为空');
    }

    if (!account.exchange_rate || account.exchange_rate <= 0) {
      errors.push('充值比例必须为正数');
    }

    return errors;
  },

  /**
   * 生成默认 emoji（已禁用）
   */
  getRandomEmoji(): string {
    return ""; // 不再使用 emoji
  },

  /**
   * 获取健康状态的显示文本和样式
   */
  getHealthStatusInfo(status: SiteHealthStatus): { text: string; color: string; bgColor: string } {
    switch (status) {
      case 'healthy':
        return { text: '正常', color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'warning':
        return { text: '警告', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
      case 'error':
        return { text: '错误', color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'unknown':
      default:
        return { text: '未知', color: 'text-gray-500', bgColor: 'bg-gray-50' };
    }
  },

  /**
   * 检查账号是否需要刷新（基于最后同步时间）
   */
  isAccountStale(account: SiteAccount, maxAgeMinutes: number = 30): boolean {
    const now = Date.now();
    const ageMinutes = (now - account.last_sync_time) / (1000 * 60);
    return ageMinutes > maxAgeMinutes;
  },

  /**
   * 获取过期的账号列表
   */
  getStaleAccounts(accounts: SiteAccount[], maxAgeMinutes: number = 30): SiteAccount[] {
    return accounts.filter(account => this.isAccountStale(account, maxAgeMinutes));
  },

  /**
   * 批量验证账号信息
   */
  async validateAccounts(accounts: SiteAccount[]): Promise<{ valid: SiteAccount[]; invalid: SiteAccount[] }> {
    const { validateAccountConnection } = await import('./apiService');
    const valid: SiteAccount[] = [];
    const invalid: SiteAccount[] = [];

    const validationPromises = accounts.map(async (account) => {
      try {
        const isValid = await validateAccountConnection(
          account.site_url,
          account.account_info.id,
          account.account_info.access_token
        );
        return { account, isValid };
      } catch {
        return { account, isValid: false };
      }
    });

    const results = await Promise.allSettled(validationPromises);
    
    results.forEach((result, index) => {
      const account = accounts[index];
      if (result.status === 'fulfilled' && result.value.isValid) {
        valid.push(account);
      } else {
        invalid.push(account);
      }
    });

    return { valid, invalid };
  }
};