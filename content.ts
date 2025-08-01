import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

// 监听来自 popup 和 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLocalStorage") {
    try {
      const { key } = request
      
      if (key) {
        // 读取特定键
        const value = localStorage.getItem(key)
        sendResponse({ success: true, data: { [key]: value } })
      } else {
        // 读取所有 localStorage 数据
        const localStorage = window.localStorage
        const data = {}
        
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i)
          if (storageKey) {
            data[storageKey] = localStorage.getItem(storageKey)
          }
        }
        
        sendResponse({ success: true, data })
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
    return true // 保持消息通道开放
  }
  
  if (request.action === "getUserFromLocalStorage") {
    try {
      // 专门获取 user 数据并解析
      const userStr = localStorage.getItem('user')
      if (!userStr) {
        sendResponse({ success: false, error: '未找到用户信息，请确保已登录' })
        return true
      }
      
      try {
        const user = JSON.parse(userStr)
        if (!user.id) {
          sendResponse({ success: false, error: '用户信息中缺少 ID 字段' })
          return true
        }
        
        sendResponse({ success: true, data: { userId: user.id, user } })
      } catch (parseError) {
        sendResponse({ success: false, error: '用户信息格式错误' })
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
    return true
  }

  if (request.action === "waitAndGetUserInfo") {
    // 新增：等待页面完全加载后获取用户信息
    waitForUserInfo()
      .then(userInfo => {
        sendResponse({ success: true, data: userInfo })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true
  }
})

// 等待用户信息可用
async function waitForUserInfo(maxWaitTime = 5000): Promise<{ userId: string, user: any }> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        if (user.id) {
          return { userId: user.id, user }
        }
      }
    } catch (error) {
      // 继续等待
    }
    
    // 等待 100ms 后重试
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  throw new Error('等待用户信息超时，请确保已登录')
}