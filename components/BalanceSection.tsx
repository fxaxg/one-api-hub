import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/outline"
import CountUp from "react-countup"

import { UI_CONSTANTS } from "../constants/ui"
import { useTimeFormatter } from "../hooks/useTimeFormatter"
import { formatTokenCount, getCurrencySymbol } from "../utils/formatters"
import Tooltip from "./Tooltip"

interface BalanceSectionProps {
  // 金额数据
  totalConsumption: { USD: number; CNY: number }
  totalBalance: { USD: number; CNY: number }
  todayTokens: { upload: number; download: number }

  // 状态
  currencyType: "USD" | "CNY"
  activeTab: "consumption" | "balance"
  isInitialLoad: boolean
  lastUpdateTime: Date

  // 动画相关
  prevTotalConsumption: { USD: number; CNY: number }

  // 显示当前站点是否已添加
  detectedAccountName?: string

  // 事件处理
  onCurrencyToggle: () => void
  onTabChange: (index: number) => void
}

export default function BalanceSection({
  totalConsumption,
  totalBalance,
  todayTokens,
  currencyType,
  activeTab,
  isInitialLoad,
  lastUpdateTime,
  prevTotalConsumption,
  detectedAccountName,
  onCurrencyToggle,
  onTabChange
}: BalanceSectionProps) {
  const { formatRelativeTime, formatFullTime } = useTimeFormatter()

  return (
    <div className="px-6 py-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
      <div className="space-y-3">
        {/* 金额标签页 */}
        <div>
          <TabGroup
            selectedIndex={activeTab === "consumption" ? 0 : 1}
            onChange={onTabChange}>
            <div className="flex justify-start mb-3">
              <TabList className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                <Tab
                  className={({ selected }) =>
                    `px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      selected
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`
                  }>
                  今日消耗
                </Tab>
                <Tab
                  className={({ selected }) =>
                    `px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      selected
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`
                  }>
                  总余额
                </Tab>
              </TabList>
            </div>

            <TabPanels>
              <TabPanel>
                {/* 今日消耗面板 */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={onCurrencyToggle}
                    className="text-5xl font-bold text-gray-900 tracking-tight hover:text-blue-600 transition-colors cursor-pointer"
                    title={`点击切换到 ${currencyType === "USD" ? "人民币" : "美元"}`}>
                    {totalConsumption[currencyType] > 0 ? "-" : ""}
                    {getCurrencySymbol(currencyType)}
                    <CountUp
                      start={
                        isInitialLoad ? 0 : prevTotalConsumption[currencyType]
                      }
                      end={totalConsumption[currencyType]}
                      duration={
                        isInitialLoad
                          ? UI_CONSTANTS.ANIMATION.INITIAL_DURATION
                          : UI_CONSTANTS.ANIMATION.UPDATE_DURATION
                      }
                      decimals={2}
                      preserveValue
                    />
                  </button>
                </div>
              </TabPanel>

              <TabPanel>
                {/* 总余额面板 */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={onCurrencyToggle}
                    className="text-5xl font-bold text-gray-900 tracking-tight hover:text-blue-600 transition-colors cursor-pointer"
                    title={`点击切换到 ${currencyType === "USD" ? "人民币" : "美元"}`}>
                    {getCurrencySymbol(currencyType)}
                    <CountUp
                      start={isInitialLoad ? 0 : 0}
                      end={totalBalance[currencyType]}
                      duration={
                        isInitialLoad
                          ? UI_CONSTANTS.ANIMATION.INITIAL_DURATION
                          : UI_CONSTANTS.ANIMATION.UPDATE_DURATION
                      }
                      decimals={2}
                      preserveValue
                    />
                  </button>
                </div>
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </div>

        {/* Token 统计信息 */}
        <div>
          <Tooltip
            content={
              <div>
                <div>提示: {todayTokens.upload.toLocaleString()} tokens</div>
                <div>补全: {todayTokens.download.toLocaleString()} tokens</div>
              </div>
            }>
            <div className="flex items-center space-x-3 cursor-help">
              <div className="flex items-center space-x-1">
                <ArrowUpIcon className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-500">
                  {formatTokenCount(todayTokens.upload)}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <ArrowDownIcon className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-gray-500">
                  {formatTokenCount(todayTokens.download)}
                </span>
              </div>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* 最后更新时间 */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="ml-2 flex items-center justify-between">
          <Tooltip content={formatFullTime(lastUpdateTime)}>
            <p className="text-xs text-gray-400 cursor-help">
              更新于 {formatRelativeTime(lastUpdateTime)}
            </p>
          </Tooltip>
          {detectedAccountName && (
            <span className="text-xs text-yellow-600 font-medium">
              ⚠️当前站点 {detectedAccountName} 已被添加
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
