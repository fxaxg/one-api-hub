export function isFirefox(): boolean {
  return (
    navigator.userAgent.indexOf(" Firefox/") !== -1 ||
    navigator.userAgent.indexOf(" Gecko/") !== -1
  )
}
