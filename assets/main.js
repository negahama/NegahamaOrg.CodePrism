//@ts-check

;(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi()

  const main = document.getElementById('main')

  const commands = [
    'findAllReference(ReferenceView)',
    'findAllReference(SearchEditor)',
    'findAllReference(GenerateDiagram)',
    'findAllImplement(ReferenceView)',
    'findAllImplement(SearchEditor)',
    'showCallHierarchy(ReferenceView)',
    'findInFiles(SearchView)',
    'findInFiles(SearchEditor)',
  ]

  commands.forEach(command => {
    document.getElementById(command)?.addEventListener('click', function (event) {
      event.preventDefault()
      vscode.postMessage({ command })
    })
  })

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', event => {
    if (main) {
      main.innerHTML = event.data.body
    }
  })
})()
