/**
 * API 服务 - 用于与 One API/New API 站点进行交互
 */

// ============= 类型定义 =============
export interface UserInfo {
  id: number
  username: string
  access_token: string | null
}

export interface AccessTokenInfo {
  username: string
  access_token: string
}

export interface TodayUsageData {
  today_quota_consumption: number
  today_prompt_tokens: number
  today_completion_tokens: number
  today_requests_count: number
}

export interface AccountData extends TodayUsageData {
  quota: number
}

export interface RefreshAccountResult {
  success: boolean
  data?: AccountData
  healthStatus: HealthCheckResult
}

export interface HealthCheckResult {
  status: "healthy" | "warning" | "error" | "unknown"
  message: string
}

export interface SiteStatusInfo {
  price?: number
  stripe_unit_price?: number
}

// 模型列表响应类型
export interface ModelsResponse {
  data: string[]
  message: string
  success: boolean
}

// 分组信息类型
export interface GroupInfo {
  desc: string
  ratio: number
}

// 分组响应类型
export interface GroupsResponse {
  data: Record<string, GroupInfo>
  message: string
  success: boolean
}

// 创建令牌请求类型
export interface CreateTokenRequest {
  name: string
  remain_quota: number
  expired_time: number
  unlimited_quota: boolean
  model_limits_enabled: boolean
  model_limits: string
  allow_ips: string
  group: string
}

// 创建令牌响应类型
export interface CreateTokenResponse {
  message: string
  success: boolean
}

// API令牌类型定义
export interface ApiToken {
  id: number
  user_id: number
  key: string
  status: number
  name: string
  created_time: number
  accessed_time: number
  expired_time: number
  remain_quota: number
  unlimited_quota: boolean
  model_limits_enabled?: boolean
  model_limits?: string
  allow_ips?: string
  used_quota: number
  group?: string // 可选字段，某些站点可能没有
  DeletedAt?: null
  models?: string // 某些站点使用 models 而不是 model_limits
}

// 模型定价信息类型
export interface ModelPricing {
  model_name: string
  model_description?: string
  quota_type: number // 0 = 按量计费，1 = 按次计费
  model_ratio: number
  model_price: number
  owner_by?: string
  completion_ratio: number
  enable_groups: string[]
  supported_endpoint_types: string[]
}

// 模型定价响应类型
export interface PricingResponse {
  data: ModelPricing[]
  group_ratio: Record<string, number>
  success: boolean
  usable_group: Record<string, string>
}

// 分页令牌响应类型
interface PaginatedTokenResponse {
  page: number
  page_size: number
  total: number
  items: ApiToken[]
}

// API 响应的通用格式
interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
}

// 日志条目类型
interface LogItem {
  quota?: number
  prompt_tokens?: number
  completion_tokens?: number
}

// 日志响应数据
interface LogResponseData {
  items: LogItem[]
  total: number
}

// ============= 常量定义 =============
const REQUEST_CONFIG = {
  DEFAULT_PAGE_SIZE: 100,
  MAX_PAGES: 100,
  HEADERS: {
    CONTENT_TYPE: "application/json",
    PRAGMA: "no-cache"
  }
} as const

// ============= 错误处理 =============
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ============= 工具函数 =============
/**
 * 创建请求头
 */
const createRequestHeaders = (
  userId: number,
  accessToken?: string
): Record<string, string> => {
  const headers: Record<string, string> = {
    "New-API-User": userId.toString(),
    "Veloera-User": userId.toString(),
    "voapi-user": userId.toString(),
    "Content-Type": REQUEST_CONFIG.HEADERS.CONTENT_TYPE,
    Pragma: REQUEST_CONFIG.HEADERS.PRAGMA
  }

  // TODO：bug，还是带上了 cookie，导致网站没有使用 access_token进行验证
  if (accessToken) {
    headers["Cookie"] = "" // 使用 Bearer token 时清空 Cookie 头
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  return headers
}

/**
 * 通用 API 请求处理器
 */
const apiRequest = async <T>(
  url: string,
  options: RequestInit,
  endpoint: string
): Promise<T> => {
  const response = await fetch(url, options)

  if (!response.ok) {
    throw new ApiError(
      `请求失败: ${response.status}`,
      response.status,
      endpoint
    )
  }

  const data: ApiResponse<T> = await response.json()
  if (!data.success || data.data === undefined) {
    throw new ApiError("响应数据格式错误", undefined, endpoint)
  }

  return data.data
}

/**
 * 创建带 cookie 认证的请求
 */
const createCookieAuthRequest = (userId: number): RequestInit => ({
  method: "GET",
  headers: createRequestHeaders(userId),
  credentials: "include"
})

/**
 * 创建带 Bearer token 认证的请求
 */
const createTokenAuthRequest = (
  userId: number,
  accessToken: string
): RequestInit => ({
  method: "GET",
  headers: createRequestHeaders(userId, accessToken),
  credentials: "omit" // 明确不携带 cookies
})

/**
 * 计算今日时间戳范围
 */
const getTodayTimestampRange = (): { start: number; end: number } => {
  const today = new Date()

  // 今日开始时间戳
  today.setHours(0, 0, 0, 0)
  const start = Math.floor(today.getTime() / 1000)

  // 今日结束时间戳
  today.setHours(23, 59, 59, 999)
  const end = Math.floor(today.getTime() / 1000)

  return { start, end }
}

/**
 * 聚合使用量数据
 */
const aggregateUsageData = (
  items: LogItem[]
): Omit<TodayUsageData, "today_requests_count"> => {
  return items.reduce(
    (acc, item) => ({
      today_quota_consumption: acc.today_quota_consumption + (item.quota || 0),
      today_prompt_tokens: acc.today_prompt_tokens + (item.prompt_tokens || 0),
      today_completion_tokens:
        acc.today_completion_tokens + (item.completion_tokens || 0)
    }),
    {
      today_quota_consumption: 0,
      today_prompt_tokens: 0,
      today_completion_tokens: 0
    }
  )
}

// ============= 核心 API 函数 =============

/**
 * 获取用户基本信息（用于账号检测） - 使用浏览器 cookie 认证
 */
export const fetchUserInfo = async (
  baseUrl: string,
  userId: number
): Promise<UserInfo> => {
  const url = `${baseUrl}/api/user/self`
  const options = createCookieAuthRequest(userId)

  const userData = await apiRequest<UserInfo>(url, options, "/api/user/self")

  return {
    id: userData.id,
    username: userData.username,
    access_token: userData.access_token || null
  }
}

/**
 * 创建访问令牌 - 使用浏览器 cookie 认证
 */
export const createAccessToken = async (
  baseUrl: string,
  userId: number
): Promise<string> => {
  const url = `${baseUrl}/api/user/token`
  const options = createCookieAuthRequest(userId)

  return await apiRequest<string>(url, options, "/api/user/token")
}

/**
 * 获取站点状态信息（包含充值比例）
 */
export const fetchSiteStatus = async (
  baseUrl: string
): Promise<SiteStatusInfo | null> => {
  try {
    const url = `${baseUrl}/api/status`
    const options = {
      method: "GET",
      headers: {
        "Content-Type": REQUEST_CONFIG.HEADERS.CONTENT_TYPE,
        Pragma: REQUEST_CONFIG.HEADERS.PRAGMA
      },
      credentials: "omit" as RequestCredentials // 明确不携带 cookies
    }

    const response = await fetch(url, options)
    if (!response.ok) {
      console.warn(`获取站点状态失败: ${response.status}`)
      return null
    }

    const data: ApiResponse<SiteStatusInfo> = await response.json()
    if (!data.success || !data.data) {
      console.warn("站点状态响应数据格式错误")
      return null
    }

    return data.data
  } catch (error) {
    console.warn("获取站点状态信息失败:", error)
    return null
  }
}

/**
 * 从站点状态信息中提取默认充值比例
 */
export const extractDefaultExchangeRate = (
  statusInfo: SiteStatusInfo | null
): number | null => {
  if (!statusInfo) {
    return null
  }

  // 优先使用 price
  if (statusInfo.price && statusInfo.price > 0) {
    return statusInfo.price
  }

  // 次选 stripe_unit_price
  if (statusInfo.stripe_unit_price && statusInfo.stripe_unit_price > 0) {
    return statusInfo.stripe_unit_price
  }

  return null
}

/**
 * 自动获取或创建访问令牌
 */
export const getOrCreateAccessToken = async (
  baseUrl: string,
  userId: number
): Promise<AccessTokenInfo> => {
  // 首先获取用户信息
  const userInfo = await fetchUserInfo(baseUrl, userId)

  let accessToken = userInfo.access_token

  // 如果没有访问令牌，则创建一个
  if (!accessToken) {
    console.log("访问令牌为空，尝试自动创建...")
    accessToken = await createAccessToken(baseUrl, userId)
    console.log("自动创建访问令牌成功")
  }

  return {
    username: userInfo.username,
    access_token: accessToken
  }
}

/**
 * 获取账号余额信息
 */
export const fetchAccountQuota = async (
  baseUrl: string,
  userId: number,
  accessToken: string
): Promise<number> => {
  const url = `${baseUrl}/api/user/self`
  const options = createTokenAuthRequest(userId, accessToken)

  const userData = await apiRequest<{ quota?: number }>(
    url,
    options,
    "/api/user/self"
  )

  return userData.quota || 0
}

/**
 * 获取今日使用情况
 */
export const fetchTodayUsage = async (
  baseUrl: string,
  userId: number,
  accessToken: string
): Promise<TodayUsageData> => {
  const { start: startTimestamp, end: endTimestamp } = getTodayTimestampRange()

  let currentPage = 1
  let totalRequestsCount = 0
  let aggregatedData = {
    today_quota_consumption: 0,
    today_prompt_tokens: 0,
    today_completion_tokens: 0
  }

  // 循环获取所有分页数据
  while (currentPage <= REQUEST_CONFIG.MAX_PAGES) {
    const params = new URLSearchParams({
      p: currentPage.toString(),
      page_size: REQUEST_CONFIG.DEFAULT_PAGE_SIZE.toString(),
      type: "0",
      token_name: "",
      model_name: "",
      start_timestamp: startTimestamp.toString(),
      end_timestamp: endTimestamp.toString(),
      group: ""
    })

    const url = `${baseUrl}/api/log/self?${params.toString()}`
    const options = createTokenAuthRequest(userId, accessToken)

    const logData = await apiRequest<LogResponseData>(
      url,
      options,
      "/api/log/self"
    )

    const items = logData.items || []
    const currentPageItemCount = items.length

    // 聚合当前页数据
    const pageData = aggregateUsageData(items)
    aggregatedData.today_quota_consumption += pageData.today_quota_consumption
    aggregatedData.today_prompt_tokens += pageData.today_prompt_tokens
    aggregatedData.today_completion_tokens += pageData.today_completion_tokens

    totalRequestsCount += currentPageItemCount

    // 检查是否还有更多数据
    const totalPages = Math.ceil(
      (logData.total || 0) / REQUEST_CONFIG.DEFAULT_PAGE_SIZE
    )
    if (currentPage >= totalPages) {
      break
    }

    currentPage++
  }

  if (currentPage > REQUEST_CONFIG.MAX_PAGES) {
    console.warn(
      `达到最大分页限制(${REQUEST_CONFIG.MAX_PAGES}页)，停止获取数据`
    )
  }

  return {
    ...aggregatedData,
    today_requests_count: totalRequestsCount
  }
}

/**
 * 获取完整的账号数据
 */
export const fetchAccountData = async (
  baseUrl: string,
  userId: number,
  accessToken: string
): Promise<AccountData> => {
  const [quota, todayUsage] = await Promise.all([
    fetchAccountQuota(baseUrl, userId, accessToken),
    fetchTodayUsage(baseUrl, userId, accessToken)
  ])

  return {
    quota,
    ...todayUsage
  }
}

/**
 * 刷新单个账号数据
 */
export const refreshAccountData = async (
  baseUrl: string,
  userId: number,
  accessToken: string
): Promise<RefreshAccountResult> => {
  try {
    const data = await fetchAccountData(baseUrl, userId, accessToken)
    return {
      success: true,
      data,
      healthStatus: {
        status: "healthy",
        message: "账号状态正常"
      }
    }
  } catch (error) {
    console.error("刷新账号数据失败:", error)
    return {
      success: false,
      healthStatus: determineHealthStatus(error)
    }
  }
}

/**
 * 验证账号连接性
 */
export const validateAccountConnection = async (
  baseUrl: string,
  userId: number,
  accessToken: string
): Promise<boolean> => {
  try {
    await fetchAccountQuota(baseUrl, userId, accessToken)
    return true
  } catch (error) {
    console.error("账号连接验证失败:", error)
    return false
  }
}

/**
 * 获取账号令牌列表
 */
export const fetchAccountTokens = async (
  baseUrl: string,
  userId: number,
  accessToken: string,
  page: number = 0,
  size: number = 100
): Promise<ApiToken[]> => {
  const params = new URLSearchParams({
    p: page.toString(),
    size: size.toString()
  })

  const url = `${baseUrl}/api/token/?${params.toString()}`
  const options = createTokenAuthRequest(userId, accessToken)

  try {
    // 尝试获取响应数据，可能是直接的数组或者分页对象
    const tokensData = await apiRequest<ApiToken[] | PaginatedTokenResponse>(
      url,
      options,
      "/api/token"
    )

    // 处理不同的响应格式
    if (Array.isArray(tokensData)) {
      // 直接返回数组格式
      return tokensData
    } else if (
      tokensData &&
      typeof tokensData === "object" &&
      "items" in tokensData
    ) {
      // 分页格式，返回 items 数组
      return tokensData.items || []
    } else {
      // 其他情况，返回空数组
      console.warn("Unexpected token response format:", tokensData)
      return []
    }
  } catch (error) {
    console.error("获取令牌列表失败:", error)
    throw error
  }
}

/**
 * 获取可用模型列表
 */
export const fetchAvailableModels = async (
  baseUrl: string,
  userId: number,
  accessToken: string
): Promise<string[]> => {
  const url = `${baseUrl}/api/user/models`
  const options = createTokenAuthRequest(userId, accessToken)

  try {
    const response = await apiRequest<string[]>(
      url,
      options,
      "/api/user/models"
    )
    return response
  } catch (error) {
    console.error("获取模型列表失败:", error)
    throw error
  }
}

/**
 * 获取用户分组信息
 */
export const fetchUserGroups = async (
  baseUrl: string,
  userId: number,
  accessToken: string
): Promise<Record<string, GroupInfo>> => {
  const url = `${baseUrl}/api/user/self/groups`
  const options = createTokenAuthRequest(userId, accessToken)

  try {
    const response = await apiRequest<Record<string, GroupInfo>>(
      url,
      options,
      "/api/user/self/groups"
    )
    return response
  } catch (error) {
    console.error("获取分组信息失败:", error)
    throw error
  }
}

/**
 * 创建新的API令牌
 */
export const createApiToken = async (
  baseUrl: string,
  userId: number,
  accessToken: string,
  tokenData: CreateTokenRequest
): Promise<boolean> => {
  const url = `${baseUrl}/api/token/`
  const options = {
    method: "POST",
    headers: createRequestHeaders(userId, accessToken),
    credentials: "omit" as RequestCredentials,
    body: JSON.stringify(tokenData)
  }

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new ApiError(
        `请求失败: ${response.status}`,
        response.status,
        "/api/token"
      )
    }

    const data: ApiResponse<any> = await response.json()

    // 对于创建令牌的响应，只检查success字段，不要求data字段存在
    if (!data.success) {
      throw new ApiError(
        data.message || "创建令牌失败",
        undefined,
        "/api/token"
      )
    }

    return true
  } catch (error) {
    console.error("创建令牌失败:", error)
    throw error
  }
}

/**
 * 获取单个API令牌详情
 */
export const fetchTokenById = async (
  baseUrl: string,
  userId: number,
  accessToken: string,
  tokenId: number
): Promise<ApiToken> => {
  const url = `${baseUrl}/api/token/${tokenId}`
  const options = createTokenAuthRequest(userId, accessToken)

  try {
    const response = await apiRequest<ApiToken>(
      url,
      options,
      `/api/token/${tokenId}`
    )
    return response
  } catch (error) {
    console.error("获取令牌详情失败:", error)
    throw error
  }
}

/**
 * 更新API令牌
 */
export const updateApiToken = async (
  baseUrl: string,
  userId: number,
  accessToken: string,
  tokenId: number,
  tokenData: CreateTokenRequest
): Promise<boolean> => {
  const url = `${baseUrl}/api/token/`
  const options = {
    method: "PUT",
    headers: createRequestHeaders(userId, accessToken),
    credentials: "omit" as RequestCredentials,
    body: JSON.stringify({ ...tokenData, id: tokenId })
  }

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new ApiError(
        `请求失败: ${response.status}`,
        response.status,
        "/api/token"
      )
    }

    const data: ApiResponse<any> = await response.json()

    if (!data.success) {
      throw new ApiError(
        data.message || "更新令牌失败",
        undefined,
        "/api/token"
      )
    }

    return true
  } catch (error) {
    console.error("更新令牌失败:", error)
    throw error
  }
}

/**
 * 删除API令牌
 */
export const deleteApiToken = async (
  baseUrl: string,
  userId: number,
  accessToken: string,
  tokenId: number
): Promise<boolean> => {
  const url = `${baseUrl}/api/token/${tokenId}`
  const options = {
    method: "DELETE",
    headers: createRequestHeaders(userId, accessToken),
    credentials: "omit" as RequestCredentials
  }

  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new ApiError(
        `请求失败: ${response.status}`,
        response.status,
        `/api/token/${tokenId}`
      )
    }

    const data: ApiResponse<any> = await response.json()

    if (!data.success) {
      throw new ApiError(
        data.message || "删除令牌失败",
        undefined,
        `/api/token/${tokenId}`
      )
    }

    return true
  } catch (error) {
    console.error("删除令牌失败:", error)
    throw error
  }
}

/**
 * 获取模型定价信息
 */
export const fetchModelPricing = async (
  baseUrl: string,
  userId: number,
  accessToken: string
): Promise<PricingResponse> => {
  const url = `${baseUrl}/api/pricing`
  const options = createTokenAuthRequest(userId, accessToken)

  try {
    // /api/pricing 接口直接返回 PricingResponse 格式，不需要通过 apiRequest 包装
    const response = await fetch(url, options)

    if (!response.ok) {
      throw new ApiError(
        `请求失败: ${response.status}`,
        response.status,
        "/api/pricing"
      )
    }

    const data: PricingResponse = await response.json()

    if (!data.success) {
      throw new ApiError("获取定价信息失败", undefined, "/api/pricing")
    }

    return data
  } catch (error) {
    console.error("获取模型定价失败:", error)
    throw error
  }
}

// ============= 健康状态判断 =============

/**
 * 根据错误判断健康状态
 */
export const determineHealthStatus = (error: any): HealthCheckResult => {
  if (error instanceof ApiError) {
    // HTTP响应码不为200的情况
    if (error.statusCode) {
      return {
        status: "warning",
        message: `HTTP ${error.statusCode}: ${error.message}`
      }
    }
    // 其他API错误（数据格式错误等）
    return {
      status: "unknown",
      message: error.message
    }
  }

  // 网络连接失败、超时等HTTP请求失败的情况
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return {
      status: "error",
      message: "网络连接失败"
    }
  }

  // 其他未知错误
  return {
    status: "unknown",
    message: error?.message || "未知错误"
  }
}
