import { useState, useMemo, useCallback, useEffect } from "react"
import { UI_CONSTANTS } from "../constants/ui"
import { createSortComparator } from "../utils/formatters"
import type { DisplaySiteData } from "../types"

type SortField = 'name' | 'balance' | 'consumption'
type SortOrder = 'asc' | 'desc'

interface UseSortResult {
  sortField: SortField
  sortOrder: SortOrder
  sortedData: DisplaySiteData[]
  handleSort: (field: SortField) => void
}

export const useSort = (
  data: DisplaySiteData[],
  currencyType: 'USD' | 'CNY',
  initialSortField?: SortField,
  initialSortOrder?: SortOrder,
  onSortChange?: (field: SortField, order: SortOrder) => void,
  pinnedAccountId?: string | null
): UseSortResult => {
  const [sortField, setSortField] = useState<SortField>(
    initialSortField || UI_CONSTANTS.SORT.DEFAULT_FIELD
  )
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    initialSortOrder || UI_CONSTANTS.SORT.DEFAULT_ORDER
  )

  // 当初始值变化时更新状态
  useEffect(() => {
    if (initialSortField !== undefined) {
      setSortField(initialSortField)
    }
  }, [initialSortField])

  useEffect(() => {
    if (initialSortOrder !== undefined) {
      setSortOrder(initialSortOrder)
    }
  }, [initialSortOrder])

  // 处理排序
  const handleSort = useCallback((field: SortField) => {
    let newOrder: SortOrder
    
    if (sortField === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
      setSortOrder(newOrder)
    } else {
      newOrder = 'asc'
      setSortField(field)  
      setSortOrder(newOrder)
    }
    
    // 通知父组件排序变化
    onSortChange?.(field === sortField ? sortField : field, newOrder)
  }, [sortField, sortOrder, onSortChange])

  // 排序数据
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      // 置顶逻辑
      if (pinnedAccountId) {
        if (a.id === pinnedAccountId && b.id !== pinnedAccountId) return -1;
        if (a.id !== pinnedAccountId && b.id === pinnedAccountId) return 1;
      }

      let aValue: string | number, bValue: string | number
      
      switch (sortField) {
        case 'name':
          aValue = a.name
          bValue = b.name
          break
        case 'balance':
          aValue = a.balance[currencyType]
          bValue = b.balance[currencyType]
          break
        case 'consumption':
          aValue = a.todayConsumption[currencyType]
          bValue = b.todayConsumption[currencyType]
          break
        default:
          return 0
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
  }, [data, sortField, sortOrder, currencyType, pinnedAccountId])

  return {
    sortField,
    sortOrder,
    sortedData,
    handleSort
  }
}