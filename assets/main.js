//@ts-check

;(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi()

  const main = document.getElementById('main')

  // const startingState = vscode.getState();

  // if (startingState) {
  //     if (startingState.body) {
  //         updateContent(startingState.body);
  //     } else if (startingState.noContent) {
  //         setNoContent(startingState.noContent);
  //     }
  // }

  let hasUpdated = false

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
    const message = event.data // The json data that the extension sent
    switch (message.type) {
      case 'update': {
        if (main) {
          main.innerHTML = message.body
          // vscode.setState({ body: message.body });
        }
        hasUpdated = true
        break
      }
      case 'noContent': {
        if (!hasUpdated || message.updateMode === 'live') {
          if (main) {
            main.innerHTML = `<p class="no-content">${message.body}</p>`
            // vscode.setState({ noContent: message.body });
          }
        }
        hasUpdated = true
        break
      }
    }
  })
})()
