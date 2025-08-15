import { ChevronUpIcon, ChevronDownIcon, ChartBarIcon, CpuChipIcon, EllipsisHorizontalIcon, DocumentDuplicateIcon, ChartPieIcon, PencilIcon, TrashIcon, ArrowPathIcon, InboxIcon, KeyIcon } from "@heroicons/react/24/outline"
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react'
import CountUp from "react-countup"
import { UI_CONSTANTS, HEALTH_STATUS_MAP } from "../constants/ui"
import { getCurrencySymbol } from "../utils/formatters"
import type { DisplaySiteData } from "../types"
import { useState, useCallback, useRef, useEffect } from 'react'
import Tooltip from './Tooltip'
import DelAccountDialog from './DelAccountDialog'
import CopyKeyDialog from './CopyKeyDialog'

type SortField = 'name' | 'balance' | 'consumption'
type SortOrder = 'asc' | 'desc'

interface AccountListProps {
  // 数据
  sites: DisplaySiteData[]
  currencyType: 'USD' | 'CNY'
  
  // 排序状态
  sortField: SortField
  sortOrder: SortOrder
  
  // 动画相关
  isInitialLoad: boolean
  prevBalances: { [id: string]: { USD: number, CNY: number } }
  
  // 刷新状态
  refreshingAccountId?: string | null
  
  // 事件处理
  onSort: (field: SortField) => void
  onAddAccount: () => void
  onRefreshAccount?: (site: DisplaySiteData) => Promise<void>
  onCopyUrl?: (site: DisplaySiteData) => void
  onViewUsage?: (site: DisplaySiteData) => void
  onViewModels?: (site: DisplaySiteData) => void
  onEditAccount?: (site: DisplaySiteData) => void
  onDeleteAccount?: (site: DisplaySiteData) => void
  onViewKeys?: (site: DisplaySiteData) => void
}

export default function AccountList({
  sites,
  currencyType,
  sortField,
  sortOrder,
  isInitialLoad,
  prevBalances,
  refreshingAccountId,
  onSort,
  onAddAccount,
  onRefreshAccount,
  onCopyUrl,
  onViewUsage,
  onViewModels,
  onEditAccount,
  onDeleteAccount,
  onViewKeys
}: AccountListProps) {
  const [hoveredSiteId, setHoveredSiteId] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [deleteDialogAccount, setDeleteDialogAccount] = useState<DisplaySiteData | null>(null)
  const [copyKeyDialogAccount, setCopyKeyDialogAccount] = useState<DisplaySiteData | null>(null)

  // 防抖的 hover 处理
  const handleMouseEnter = useCallback((siteId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredSiteId(siteId)
    }, 50) // 100ms 防抖延迟
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredSiteId(null)
    }, 0) // 不需要离开时的延迟
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCopyUrl = (site: DisplaySiteData) => {
    copyToClipboard(site.baseUrl)
    onCopyUrl?.(site)
  }

  const handleCopyKey = (site: DisplaySiteData) => {
    setCopyKeyDialogAccount(site)
  }

  const handleRefreshAccount = async (site: DisplaySiteData) => {
    if (onRefreshAccount) {
      try {
        await onRefreshAccount(site)
      } catch (error) {
        console.error('刷新账号失败:', error)
      }
    }
  }
  if (sites.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <InboxIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <p className="text-gray-500 text-sm mb-4">暂无站点账号</p>
        <button 
          onClick={onAddAccount}
          className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
        >
          添加第一个站点账号
        </button>
      </div>
    )
  }

  const renderSortButton = (field: SortField, label: string) => (
    <button
      onClick={() => onSort(field)}
      className="flex items-center space-x-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
    >
      <span>{label}</span>
      {sortField === field && (
        sortOrder === 'asc' ? 
          <ChevronUpIcon className="w-3 h-3" /> : 
          <ChevronDownIcon className="w-3 h-3" />
      )}
    </button>
  )

  return (
    <div className="flex flex-col">
      {/* 表头 */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            {renderSortButton('name', '账号')}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center space-x-1">
              {renderSortButton('balance', '余额')}
              <span className="text-xs text-gray-400">/</span>
              {renderSortButton('consumption', '今日消耗')}
            </div>
          </div>
        </div>
      </div>
      
      {/* 账号列表 */}
      {sites.map((site) => (
        <div 
          key={site.id} 
          className="px-5 py-4 border-b border-gray-50 hover:bg-gray-25 transition-colors relative group"
          onMouseEnter={() => handleMouseEnter(site.id)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center space-x-4">
            {/* 站点信息 */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-0.5">
                  {/* 站点状态指示器 */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    HEALTH_STATUS_MAP[site.healthStatus]?.color || UI_CONSTANTS.STYLES.STATUS_INDICATOR.UNKNOWN
                  }`}></div>
                  <div className="font-medium text-gray-900 text-sm truncate">
                    <a
                      href={site.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {site.name}
                    </a>
                  </div>
                </div>
                <div className="text-xs text-gray-500 truncate ml-4">{site.username}</div>
              </div>
            </div>
            
            {/* 按钮组 - 只在 hover 时显示 */}
            {hoveredSiteId === site.id && (
              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* 刷新按钮 */}
                <Tooltip content="刷新账号" position="top">
                  <button
                    onClick={() => handleRefreshAccount(site)}
                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                    disabled={refreshingAccountId === site.id}
                  >
                    <ArrowPathIcon 
                      className={`w-4 h-4 text-gray-500 ${
                        refreshingAccountId === site.id ? 'animate-spin' : ''
                      }`} 
                    />
                  </button>
                </Tooltip>

                {/* 复制下拉菜单 */}
                <Menu as="div" className="relative">
                  <Tooltip content="复制" position="top">
                    <MenuButton className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors">
                      <DocumentDuplicateIcon className="w-4 h-4 text-gray-500" />
                    </MenuButton>
                  </Tooltip>
                  <MenuItems 
                    anchor="bottom end"
                    className="z-50 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 focus:outline-none [--anchor-gap:4px] [--anchor-padding:8px]"
                  >
                    <MenuItem>
                      <button
                        onClick={() => handleCopyUrl(site)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:text-gray-900 data-focus:bg-gray-50 flex items-center space-x-2"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        <span>复制 URL</span>
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        onClick={() => handleCopyKey(site)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:text-gray-900 data-focus:bg-gray-50 flex items-center space-x-2"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        <span>复制密钥</span>
                      </button>
                    </MenuItem>
                    <hr />
                    <MenuItem>
                      <button
                        onClick={() => onViewKeys?.(site)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:text-gray-900 data-focus:bg-gray-50 flex items-center space-x-2"
                      >
                        <KeyIcon className="w-4 h-4" />
                        <span>管理密钥</span>
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>

                {/* 更多下拉菜单 */}
                <Menu as="div" className="relative">
                    <MenuButton className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors">
                      <EllipsisHorizontalIcon className="w-4 h-4 text-gray-500" />
                    </MenuButton>
                  <MenuItems 
                    anchor="bottom end"
                    className="z-50 w-24 bg-white rounded-lg shadow-lg border border-gray-200 py-1 focus:outline-none [--anchor-gap:4px] [--anchor-padding:8px]"
                  >
                    <MenuItem>
                      <button
                        onClick={() => onViewModels?.(site)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:text-gray-900 data-focus:bg-gray-50 flex items-center space-x-2"
                      >
                        <CpuChipIcon className="w-4 h-4" />
                        <span>模型</span>
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        onClick={() => onViewUsage?.(site)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:text-gray-900 data-focus:bg-gray-50 flex items-center space-x-2"
                      >
                        <ChartPieIcon className="w-4 h-4" />
                        <span>用量</span>
                      </button>
                    </MenuItem>
                    <hr />
                    <MenuItem>
                      <button
                        onClick={() => onEditAccount?.(site)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:text-gray-900 data-focus:bg-gray-50 flex items-center space-x-2"
                      >
                        <PencilIcon className="w-4 h-4" />
                        <span>编辑</span>
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        onClick={() => setDeleteDialogAccount(site)}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:text-red-700 data-focus:bg-red-50 flex items-center space-x-2"
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span>删除</span>
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              </div>
            )}
            
            {/* 余额和统计 */}
            <div className="text-right flex-shrink-0">
              <div className="font-semibold text-gray-900 text-lg mb-0.5">
                {getCurrencySymbol(currencyType)}
                <CountUp
                  start={isInitialLoad ? 0 : (prevBalances[site.id]?.[currencyType] || 0)}
                  end={site.balance[currencyType]}
                  duration={isInitialLoad ? UI_CONSTANTS.ANIMATION.SLOW_DURATION : UI_CONSTANTS.ANIMATION.FAST_DURATION}
                  decimals={2}
                  preserveValue
                />
              </div>
              <div className={`text-xs ${site.todayConsumption[currencyType] > 0 ? 'text-green-500' : 'text-gray-400'}`}>
                -{getCurrencySymbol(currencyType)}
                <CountUp
                  start={isInitialLoad ? 0 : 0}
                  end={site.todayConsumption[currencyType]}
                  duration={isInitialLoad ? UI_CONSTANTS.ANIMATION.SLOW_DURATION : UI_CONSTANTS.ANIMATION.FAST_DURATION}
                  decimals={2}
                  preserveValue
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* 删除账号确认对话框 */}
      <DelAccountDialog
        isOpen={deleteDialogAccount !== null}
        onClose={() => setDeleteDialogAccount(null)}
        account={deleteDialogAccount}
        onDeleted={() => onDeleteAccount?.(deleteDialogAccount!)}
      />

      {/* 复制密钥对话框 */}
      <CopyKeyDialog
        isOpen={copyKeyDialogAccount !== null}
        onClose={() => setCopyKeyDialogAccount(null)}
        account={copyKeyDialogAccount}
      />
    </div>
  )
}