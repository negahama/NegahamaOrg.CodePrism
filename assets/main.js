//@ts-check

;(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi()

  const main = document.getElementById('main')

  document.getElementById('openFindAllReference')?.addEventListener('click', function (event) {
    event.preventDefault()
    vscode.postMessage({ command: 'openFindAllReference' })
  })

  document.getElementById('openFindAllImplement')?.addEventListener('click', function (event) {
    event.preventDefault()
    vscode.postMessage({ command: 'openFindAllImplement' })
  })

  document.getElementById('openShowCallHierarchy')?.addEventListener('click', function (event) {
    event.preventDefault()
    vscode.postMessage({ command: 'openShowCallHierarchy' })
  })

  document.getElementById('openFindInFiles')?.addEventListener('click', function (event) {
    event.preventDefault()
    vscode.postMessage({ command: 'openFindInFiles' })
  })

  document.getElementById('openSearchEditor')?.addEventListener('click', function (event) {
    event.preventDefault()
    vscode.postMessage({ command: 'openSearchEditor' })
  })

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', event => {
    if (main) {
      main.innerHTML = event.data.body
    }
  })
})()
