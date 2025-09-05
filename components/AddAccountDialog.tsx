import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild
} from "@headlessui/react"
import {
  CurrencyDollarIcon,
  EyeIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  KeyIcon,
  PencilIcon,
  SparklesIcon,
  UserIcon,
  XMarkIcon
} from "@heroicons/react/24/outline"
import { Fragment, useEffect, useState } from "react"
import toast from "react-hot-toast"

import {
  autoDetectAccount,
  extractDomainPrefix,
  isValidExchangeRate,
  validateAndSaveAccount
} from "../services/accountOperations"
import type { DisplaySiteData } from "../types"
import type { AutoDetectError } from "../utils/autoDetectUtils"
import AutoDetectErrorAlert from "./AutoDetectErrorAlert"

interface AddAccountDialogProps {
  isOpen: boolean
  onClose: () => void
  isCurrentSiteAdded?: boolean
  onEditAccount?: (account: DisplaySiteData) => void
  detectedAccount?: DisplaySiteData | null
}

export default function AddAccountDialog({
  isOpen,
  onClose,
  isCurrentSiteAdded,
  onEditAccount,
  detectedAccount
}: AddAccountDialogProps) {
  const [url, setUrl] = useState("")
  const [isDetecting, setIsDetecting] = useState(false)
  const [siteName, setSiteName] = useState("")
  const [username, setUsername] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [userId, setUserId] = useState("")
  const [isDetected, setIsDetected] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showAccessToken, setShowAccessToken] = useState(false)
  const [detectionError, setDetectionError] = useState<AutoDetectError | null>(
    null
  )
  const [showManualForm, setShowManualForm] = useState(false)
  const [exchangeRate, setExchangeRate] = useState("")
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      // 重置状态
      setIsDetected(false)
      setSiteName("")
      setUsername("")
      setAccessToken("")
      setUserId("")
      setShowAccessToken(false)
      setDetectionError(null)
      setShowManualForm(false)
      setExchangeRate("")
      setCurrentTabUrl(null)
      setUrl("")

      // 获取当前标签页的 URL 作为初始参考
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          try {
            const urlObj = new URL(tabs[0].url)
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`
            // 如果站点不是以http开头，则不处理（可能为空白页）
            if (!baseUrl.startsWith("http")) {
              return
            }
            setCurrentTabUrl(baseUrl)
            // 设置站点名称为域名前缀，但不自动填入URL
            const domainPrefix = extractDomainPrefix(urlObj.hostname)
            setSiteName(domainPrefix)
          } catch (error) {
            console.log("无法解析 URL:", error)
            setCurrentTabUrl(null)
            setSiteName("")
          }
        }
      })
    }
  }, [isOpen])

  // 处理点击当前标签页 URL
  const handleUseCurrentTabUrl = () => {
    if (currentTabUrl) {
      setUrl(currentTabUrl)
    }
  }

  const handleAutoDetect = async () => {
    if (!url.trim()) {
      return
    }

    setIsDetecting(true)
    setDetectionError(null)

    try {
      const result = await autoDetectAccount(url.trim())

      if (!result.success) {
        setDetectionError(result.detailedError || null)
        setShowManualForm(true)
        return
      }

      if (result.data) {
        // 更新表单数据
        setUsername(result.data.username)
        setAccessToken(result.data.accessToken)
        setUserId(result.data.userId)

        // 设置充值比例默认值
        if (result.data.exchangeRate) {
          setExchangeRate(result.data.exchangeRate.toString())
          console.log("获取到默认充值比例:", result.data.exchangeRate)
        } else {
          setExchangeRate("") // 如果没有获取到，设置为空
          console.log("未获取到默认充值比例，设置为空")
        }

        setIsDetected(true)

        console.log("自动识别成功:", {
          username: result.data.username,
          siteName,
          exchangeRate: result.data.exchangeRate
        })
      }
    } catch (error) {
      console.error("自动识别失败:", error)
      const errorMessage = error instanceof Error ? error.message : "未知错误"
      // 使用通用错误处理
      setDetectionError({
        type: "unknown" as any,
        message: `自动识别失败: ${errorMessage}`,
        helpDocUrl: "#"
      })
      setShowManualForm(true) // 识别失败后显示手动表单
    } finally {
      setIsDetecting(false)
    }
  }

  const handleSaveAccount = async () => {
    setIsSaving(true)

    try {
      await toast.promise(
        validateAndSaveAccount(
          url.trim(),
          siteName.trim(),
          username.trim(),
          accessToken.trim(),
          userId.trim(),
          exchangeRate
        ),
        {
          loading: "正在添加账号...",
          success: (result) => {
            if (result.success) {
              onClose()
              return `账号 ${siteName} 添加成功!`
            } else {
              throw new Error(result.error || "保存失败")
            }
          },
          error: (err) => {
            const errorMsg = err.message || "添加失败"
            return `添加失败: ${errorMsg}`
          }
        }
      )
    } catch (error) {
      console.error("保存账号失败:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isDetected || showManualForm) {
      handleSaveAccount()
    } else {
      handleAutoDetect()
    }
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* 背景遮罩动画 */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            aria-hidden="true"
          />
        </TransitionChild>

        {/* 居中容器 - 针对插件优化 */}
        <div className="fixed inset-0 flex items-center justify-center p-2">
          {/* 弹窗面板动画 */}
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95 translate-y-4"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95 translate-y-4">
            <DialogPanel className="w-full max-w-sm bg-white rounded-lg shadow-xl transform transition-all max-h-[90vh] overflow-y-auto">
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <SparklesIcon className="w-4 h-4 text-white" />
                  </div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    新增账号
                  </DialogTitle>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* 内容区域 */}
              <div className="p-4">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 识别错误提示 */}
                  {detectionError && (
                    <AutoDetectErrorAlert
                      error={detectionError}
                      siteUrl={url}
                    />
                  )}

                  {/* URL 输入框 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      站点地址
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const inputUrl = e.target.value

                          // 当用户输入 URL 时，提取协议和主机部分
                          if (inputUrl.trim()) {
                            try {
                              const urlObj = new URL(inputUrl)
                              // 只保留协议和主机部分，不带路径
                              const baseUrl = `${urlObj.protocol}//${urlObj.host}`
                              setUrl(baseUrl)

                              // 自动更新站点名称
                              const domainPrefix = extractDomainPrefix(
                                urlObj.hostname
                              )
                              setSiteName(domainPrefix)
                            } catch (error) {
                              // 如果 URL 格式不完整，先保存用户输入，但尝试提取域名
                              setUrl(inputUrl)
                              const match = inputUrl.match(/\/\/([^\/]+)/)
                              if (match) {
                                const domainPrefix = extractDomainPrefix(
                                  match[1]
                                )
                                setSiteName(domainPrefix)
                              }
                            }
                          } else {
                            setUrl("")
                            setSiteName("")
                          }
                        }}
                        placeholder="https://example.com"
                        className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        required
                        disabled={isDetected}
                      />
                      {url && (
                        <button
                          type="button"
                          onClick={() => setUrl("")}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                          disabled={isDetected}>
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      请输入 One API 或 New API 站点的完整地址
                    </p>

                    {/* 已添加提示 */}
                    <Transition
                      show={isCurrentSiteAdded && !!currentTabUrl && !url}
                      as={Fragment}>
                      <TransitionChild
                        as="div"
                        enter="ease-out duration-300 delay-200"
                        enterFrom="opacity-0 translate-y-2"
                        enterTo="opacity-100 translate-y-0"
                        className="mt-2">
                        <div className="flex items-center justify-between text-xs text-yellow-700 bg-yellow-50 p-2 rounded-md">
                          <div className="flex items-center">
                            <InformationCircleIcon className="w-4 h-4 mr-1.5 flex-shrink-0" />
                            <span>当前站点已添加</span>
                          </div>
                          {onEditAccount && detectedAccount && (
                            <button
                              type="button"
                              onClick={() => onEditAccount(detectedAccount)}
                              className="flex items-center font-medium text-yellow-800 hover:text-yellow-900">
                              <PencilIcon className="w-3 h-3 mr-1" />
                              <span>立即编辑</span>
                            </button>
                          )}
                        </div>
                      </TransitionChild>
                    </Transition>

                    {/* 当前标签页 URL 提示 */}
                    <Transition show={!!(currentTabUrl && !url)} as={Fragment}>
                      <TransitionChild
                        as="div"
                        enter="ease-out duration-500 delay-500"
                        enterFrom="opacity-0 translate-y-3 scale-90"
                        enterTo="opacity-100 translate-y-0 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 translate-y-0 scale-100"
                        leaveTo="opacity-0 translate-y-2 scale-95"
                        className="mt-2">
                        <button
                          type="button"
                          onClick={handleUseCurrentTabUrl}
                          className="inline-flex items-center px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm hover:shadow-md">
                          <GlobeAltIcon className="w-3 h-3 mr-1.5 animate-pulse" />
                          <span>
                            使用当前:{" "}
                            {currentTabUrl && new URL(currentTabUrl).host}
                          </span>
                        </button>
                      </TransitionChild>
                    </Transition>
                  </div>

                  {/* 识别成功后的表单或手动添加表单 */}
                  {(isDetected || showManualForm) && (
                    <>
                      {/* 网站名称 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          网站名称
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            value={siteName}
                            onChange={(e) => setSiteName(e.target.value)}
                            placeholder="example.com"
                            className="block w-full pl-10 py-3 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            required
                          />
                        </div>
                      </div>

                      {/* 用户名 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          用户名
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <UserIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="用户名"
                            className="block w-full pl-10 py-3 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            required
                          />
                        </div>
                      </div>

                      {/* 用户 ID */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          用户 ID
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-400 font-mono text-sm">
                              #
                            </span>
                          </div>
                          <input
                            type="number"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="用户 ID (数字)"
                            className="block w-full pl-10 py-3 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            required
                          />
                        </div>
                      </div>

                      {/* 访问令牌 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          访问令牌
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <KeyIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type={showAccessToken ? "text" : "password"}
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            placeholder="访问令牌"
                            className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowAccessToken(!showAccessToken)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                            {showAccessToken ? (
                              <EyeSlashIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 充值金额比例 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          充值金额比例 (CNY/USD)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="100"
                            value={exchangeRate}
                            onChange={(e) => setExchangeRate(e.target.value)}
                            placeholder="请输入充值比例"
                            className={`block w-full pl-10 py-3 border rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
                              isValidExchangeRate(exchangeRate)
                                ? "border-gray-200 focus:ring-blue-500 focus:border-transparent"
                                : "border-red-300 focus:ring-red-500 focus:border-red-500"
                            }`}
                            required
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-sm text-gray-500">CNY</span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          表示充值 1
                          美元需要多少人民币。系统会尝试自动获取，如未获取到请手动填写
                        </p>
                        {!isValidExchangeRate(exchangeRate) && exchangeRate && (
                          <p className="mt-1 text-xs text-red-600">
                            请输入有效的汇率 (0.1 - 100)
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* 按钮组 */}
                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                      取消
                    </button>
                    {isDetected ? (
                      <button
                        type="submit"
                        disabled={
                          !siteName.trim() ||
                          !username.trim() ||
                          !accessToken.trim() ||
                          !userId.trim() ||
                          !isValidExchangeRate(exchangeRate) ||
                          isSaving
                        }
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>保存中...</span>
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="w-4 h-4" />
                            <span>确认添加</span>
                          </>
                        )}
                      </button>
                    ) : showManualForm ? (
                      <button
                        type="submit"
                        disabled={
                          !siteName.trim() ||
                          !username.trim() ||
                          !accessToken.trim() ||
                          !userId.trim() ||
                          !isValidExchangeRate(exchangeRate) ||
                          isSaving
                        }
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>保存中...</span>
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="w-4 h-4" />
                            <span>手动添加</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!url.trim() || isDetecting}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                        {isDetecting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>识别中...</span>
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="w-4 h-4" />
                            <span>自动识别</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* 手动添加按钮 - 在自动识别失败后显示 */}
                  {!isDetected && !showManualForm && detectionError && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowManualForm(true)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                        <UserIcon className="w-4 h-4" />
                        <span>手动添加账号信息</span>
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* 提示信息 */}
              <div className="px-4 pb-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <SparklesIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-xs font-medium text-blue-800">
                        {isDetected
                          ? "账号信息确认"
                          : showManualForm
                            ? "手动添加"
                            : "自动识别"}
                      </h3>
                      <div className="mt-1 text-xs text-blue-700">
                        <p>
                          {isDetected
                            ? '请确认账号信息无误后点击"确认添加"按钮。'
                            : showManualForm
                              ? "请手动填写账号信息。账号将被安全地保存在本地存储中。"
                              : "请先在目标站点进行登录，插件将自动检测站点类型，并自动获取访问令牌。"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
