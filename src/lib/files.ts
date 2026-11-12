type ShareCapableNavigator = Navigator & {
  canShare?: (data?: { files?: File[] }) => boolean
  share?: (data?: { files?: File[]; title?: string }) => Promise<void>
}

/**
 * Share a file with the iOS share sheet when possible, otherwise download it.
 * Returns false when the user cancels the share sheet.
 */
export async function saveFile(filename: string, blob: Blob): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as ShareCapableNavigator

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return true
    } catch {
      return false
    }
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  return true
}
