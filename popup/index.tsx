


import "./style.css"

import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"

import AccountList from "../components/AccountList"
import ActionButtons from "../components/ActionButtons"
import AddAccountDialog from "../components/AddAccountDialog"
import BalanceSection from "../components/BalanceSection"
import EditAccountDialog from "../components/EditAccountDialog"
import HeaderSection from "../components/HeaderSection"
import { UI_CONSTANTS } from "../constants/ui"
import { useAccountData } from "../hooks/useAccountData"
import { useSort } from "../hooks/useSort"
import { useUserPreferences } from "../hooks/useUserPreferences"
import { accountStorage } from "../services/accountStorage"
import type { DisplaySiteData, SiteAccount } from "../types"
import {
  calculateTotalBalance,
  calculateTotalConsumption,
  getOppositeCurrency
} from "../utils/formatters"


function IndexPopup() {
  // 用户偏好设置管理
  const {
    preferences,
    isLoading: preferencesLoading,
    activeTab,
    currencyType,
    sortField,
    sortOrder,
    updateActiveTab,
    updateCurrencyType,
    updateSortConfig
  } = useUserPreferences()

  // 状态管理
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false)
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<DisplaySiteData | null>(null)
  const [refreshingAccountId, setRefreshingAccountId] = useState<string | null>(null)
  const [detectedAccount, setDetectedAccount] = useState<SiteAccount | null>(null)

  // 数据管理
  const {
    accounts,
    displayData,
    stats,
    lastUpdateTime,
    isInitialLoad,
    isRefreshing,
    prevTotalConsumption,
    prevBalances,
    loadAccountData,
    handleRefresh
  } = useAccountData()

  // 排序管理 - 使用持久化的排序配置
  const { sortField: currentSortField, sortOrder: currentSortOrder, sortedData, handleSort } = useSort(
    displayData, 
    currencyType, 
    sortField, 
    sortOrder,
    updateSortConfig,
    detectedAccount?.id
  )

  // 计算数据 - 使用 useMemo 缓存
  const totalConsumption = useMemo(() => 
    calculateTotalConsumption(stats, accounts), 
    [stats, accounts]
  )
  
  const totalBalance = useMemo(() => 
    calculateTotalBalance(displayData), 
    [displayData]
  )
  
  const todayTokens = useMemo(() => ({
    upload: stats.today_total_prompt_tokens,
    download: stats.today_total_completion_tokens
  }), [stats.today_total_prompt_tokens, stats.today_total_completion_tokens])

  // 事件处理 - 使用 useCallback 优化
  const handleCurrencyToggle = useCallback(async () => {
    const newCurrency = getOppositeCurrency(currencyType)
    await updateCurrencyType(newCurrency)
  }, [currencyType, updateCurrencyType])

  const handleTabChange = useCallback(async (index: number) => {
    const newTab = index === 0 ? 'consumption' : 'balance'
    await updateActiveTab(newTab)
    console.log(`切换到${newTab === 'consumption' ? '今日消耗' : '总余额'}标签页`)
  }, [updateActiveTab])

  const handleOpenTab = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })
  }, [])

  const handleOpenSettings = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html#basic') })
  }, [])

  const handleAddAccount = useCallback(() => {
    setIsAddAccountOpen(true)
  }, [])

  const handleCloseAddAccount = useCallback(() => {
    setIsAddAccountOpen(false)
    loadAccountData() // 重新加载数据
  }, [loadAccountData])

  const handleEditAccount = useCallback((account: DisplaySiteData) => {
    setEditingAccount(account)
    setIsEditAccountOpen(true)
    console.log('编辑账号:', account.name)
  }, [])

  const handleCloseEditAccount = useCallback(() => {
    setIsEditAccountOpen(false)
    setEditingAccount(null)
    loadAccountData() // 重新加载数据
  }, [loadAccountData])

  const handleDeleteAccount = useCallback((account: DisplaySiteData) => {
    console.log('删除账号:', account.name)
    loadAccountData() // 重新加载数据
  }, [loadAccountData])

  const handleGlobalRefresh = useCallback(async () => {
    try {
      await toast.promise(
        handleRefresh(),
        {
          loading: '正在刷新所有账号...',
          success: (result) => {
            if (result.failed > 0) {
              return `刷新完成：${result.success} 个成功，${result.failed} 个失败`
            }
            return '所有账号刷新成功!'
          },
          error: '刷新失败，请稍后重试',
        }
      )
    } catch (error) {
      console.error('刷新时出错:', error)
    }
  }, [handleRefresh])

  const handleRefreshAccount = useCallback(async (account: DisplaySiteData) => {
    if (refreshingAccountId) return // 防止重复刷新
    
    setRefreshingAccountId(account.id)
    
    const refreshPromise = async () => {
      console.log('开始刷新账号:', account.name)
      const success = await accountStorage.refreshAccount(account.id)
      
      if (success) {
        console.log('账号刷新成功:', account.name)
        // 刷新成功后重新加载数据，这将触发动画
        await loadAccountData()
        return success
      } else {
        console.warn('账号刷新失败:', account.name)
        throw new Error('刷新失败')
      }
    }
    
    try {
      await toast.promise(
        refreshPromise(),
        {
          loading: `正在刷新 ${account.name}...`,
          success: `${account.name} 刷新成功!`,
          error: `${account.name} 刷新失败`,
        }
      )
    } catch (error) {
      console.error('刷新账号时出错:', error)
    } finally {
      setRefreshingAccountId(null)
    }
  }, [refreshingAccountId, loadAccountData])

  const handleCopyUrl = useCallback((account: DisplaySiteData) => {
    toast.success(`已复制 ${account.name} 的URL到剪贴板`)
  }, [])

  const handleViewKeys = useCallback((account: DisplaySiteData) => {
    const url = chrome.runtime.getURL(`options.html#keys?accountId=${account.id}`)
    chrome.tabs.create({ url })
  }, [])

  const handleViewKeysGlobal = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html#keys') })
  }, [])

  const handleViewModels = useCallback((account: DisplaySiteData) => {
    const url = chrome.runtime.getURL(`options.html#models?accountId=${account.id}`)
    chrome.tabs.create({ url })
  }, [])

  const handleViewModelsGlobal = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html#models') })
  }, [])

  const handleViewUsage = useCallback((account: DisplaySiteData) => {
    const logUrl = `${account.baseUrl}/log`
    chrome.tabs.create({ url: logUrl })
  }, [])

  // 处理打开插件时自动刷新
  useEffect(() => {
    let hasTriggered = false; // 防止重复触发
    
    const handleRefreshOnOpen = async () => {
      // 等待偏好设置加载完成
      if (preferencesLoading || !preferences || hasTriggered) {
        return;
      }

      // 检查是否启用了打开插件时自动刷新
      if (preferences.refreshOnOpen) {
        hasTriggered = true;
        console.log('[Popup] 打开插件时自动刷新已启用，开始刷新');
        try {
          await handleRefresh();
          console.log('[Popup] 打开插件时自动刷新完成');
        } catch (error) {
          console.error('[Popup] 打开插件时自动刷新失败:', error);
        }
      }
    };

    handleRefreshOnOpen();
  }, [preferencesLoading, preferences?.refreshOnOpen]); // 只依赖必要的属性

  // 监听后台自动刷新的更新通知
  useEffect(() => {
    const handleBackgroundRefreshUpdate = (message: any) => {
      if (message.type === 'AUTO_REFRESH_UPDATE') {
        const { type, data } = message.payload;
        
        if (type === 'refresh_completed') {
          console.log('[Popup] 后台刷新完成，重新加载数据');
          loadAccountData(); // 重新加载数据以更新UI
        } else if (type === 'refresh_error') {
          console.error('[Popup] 后台刷新失败:', data.error);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleBackgroundRefreshUpdate);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleBackgroundRefreshUpdate);
    };
  }, [loadAccountData]);

  // 当 popup 打开时，自动检测当前 URL 是否已添加
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.url) {
        try {
          const existingAccount = await accountStorage.checkUrlExists(tabs[0].url);
          if (existingAccount) {
            setDetectedAccount(existingAccount);
            console.log('检测到已存在的账号:', existingAccount.site_name);
          }
        } catch (error) {
          console.error('检测已存在账号时出错:', error);
        }
      }
    });
  }, []);

  return (
    <div className={`${UI_CONSTANTS.POPUP.WIDTH} bg-white flex flex-col ${UI_CONSTANTS.POPUP.HEIGHT}`}>
      {/* 顶部导航栏 */}
      <HeaderSection
        isRefreshing={isRefreshing}
        onRefresh={handleGlobalRefresh}
        onOpenTab={handleOpenTab}
        onOpenSettings={handleOpenSettings}
      />

      {/* 滚动内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {/* 基本信息展示 */}
        {!preferencesLoading && (
          <BalanceSection
            totalConsumption={totalConsumption}
            totalBalance={totalBalance}
            todayTokens={todayTokens}
            currencyType={currencyType}
            activeTab={activeTab}
            isInitialLoad={isInitialLoad}
            lastUpdateTime={lastUpdateTime}
            prevTotalConsumption={prevTotalConsumption}
            detectedAccountName={detectedAccount?.site_name}
            onCurrencyToggle={handleCurrencyToggle}
            onTabChange={handleTabChange}
          />
        )}

        {/* 操作按钮组 */}
        <ActionButtons 
          onAddAccount={handleAddAccount}
          onViewKeys={handleViewKeysGlobal}
          onViewModels={handleViewModelsGlobal}
        />

        {/* 站点账号列表 */}
        <AccountList
          sites={sortedData}
          currencyType={currencyType}
          sortField={currentSortField}
          sortOrder={currentSortOrder}
          isInitialLoad={isInitialLoad}
          prevBalances={prevBalances}
          refreshingAccountId={refreshingAccountId}
          detectedAccountId={detectedAccount?.id}
          onSort={handleSort}
          onAddAccount={handleAddAccount}
          onRefreshAccount={handleRefreshAccount}
          onCopyUrl={handleCopyUrl}
          onViewKeys={handleViewKeys}
          onViewModels={handleViewModels}
          onViewUsage={handleViewUsage}
          onEditAccount={handleEditAccount}
          onDeleteAccount={handleDeleteAccount}
        />
      </div>

      {/* 新增账号弹窗 */}
      <AddAccountDialog
        isOpen={isAddAccountOpen}
        onClose={handleCloseAddAccount}
        isCurrentSiteAdded={!!detectedAccount}
        onEditAccount={handleEditAccount}
        detectedAccount={displayData.find(acc => acc.id === detectedAccount?.id) ?? null}
      />
      
      {/* 编辑账号弹窗 */}
      <EditAccountDialog 
        isOpen={isEditAccountOpen}
        onClose={handleCloseEditAccount}
        account={editingAccount}
      />
      
      {/* Toast通知组件 */}
      <Toaster
        position="bottom-center"
        reverseOrder={true}
      />
    </div>
  )
}

export default IndexPopup
