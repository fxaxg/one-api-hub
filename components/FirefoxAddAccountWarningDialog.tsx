import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild
} from "@headlessui/react"
import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { Fragment } from "react"

interface FirefoxWarningDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function FirefoxAddAccountWarningDialog({
  isOpen,
  onClose,
  onConfirm
}: FirefoxWarningDialogProps) {
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
            <DialogPanel className="w-full max-w-sm bg-white rounded-lg shadow-xl transform transition-all">
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
                    <ExclamationTriangleIcon className="w-4 h-4 text-white" />
                  </div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    功能限制提醒
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
                <div className="space-y-4">
                  <div className="text-center">
                    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-orange-500" />
                    <div className="mt-3">
                      <h3 className="text-base font-medium text-gray-900">
                        Firefox 浏览器功能限制
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          在 Firefox
                          浏览器的弹窗中无法正常使用此功能。请使用侧边栏模式来添加账号。
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <ExclamationTriangleIcon className="h-5 w-5 text-orange-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-xs font-medium text-orange-800">
                          如何打开侧边栏
                        </h3>
                        <div className="mt-1 text-xs text-orange-700">
                          <p>
                            点击浏览器工具栏中的插件图标，然后选择"侧边栏"选项来打开侧边栏模式。
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 按钮组 */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                    确定
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-amber-600 rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    打开侧边栏
                  </button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
