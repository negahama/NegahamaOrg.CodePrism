import * as vscode from 'vscode'
import { DefinitionViewRenderer } from './DefinitionViewRenderer'

/**
 * 이 클래스는 다음의 두가지 built-in command를 사용한다.
 * 이 클래스는 이들 기능을 이용해서 특정 심볼의 자세한 정보를 웹뷰에 표시하는 역할을 한다.
 * - vscode.executeHoverProvider
 * - vscode.executeDefinitionProvider
 *
 * vscode.executeHoverProvider는 현재 커서 위치의 심볼에 대한 선언과 주석을 가져오고
 * vscode.executeDefinitionProvider는 정의되어진 구문 전체를 가져온다.
 *
 * Provides a webview view for displaying comments in the CodePrism extension.
 * Implements the `vscode.WebviewViewProvider` interface.
 *
 * This class is responsible for creating and managing the webview that displays
 * comments related to the code in the active text editor. It handles the lifecycle
 * of the webview, updates its content based on the active editor, and manages
 * the pinned state of the view.
 *
 * @remarks
 * The webview content is generated dynamically based on the active text editor's
 * content and selection. The view can be pinned to prevent it from updating
 * automatically when the active editor changes.
 *
 * @example
 * ```typescript
 * const provider = new DefinitionViewProvider(extensionUri);
 * vscode.window.registerWebviewViewProvider(DefinitionViewProvider.viewType, provider);
 * ```
 *
 * @param extensionUri - The URI of the extension's root directory.
 *
 * @property viewType - The unique identifier for the comment view.
 * @property pinnedContext - The context key used to track the pinned state of the view.
 * @property view - The current webview view instance.
 * @property loading - The current loading state, including a cancellation token source.
 * @property pinned - Indicates whether the view is pinned.
 * @property _disposables - An array of disposables to clean up resources.
 *
 * @method dispose - Disposes of the resources used by the provider.
 * @method resolveWebviewView - Resolves the webview view when it becomes visible.
 * @method pin - Pins the view to prevent automatic updates.
 * @method unpin - Unpins the view to allow automatic updates.
 * @method update - Updates the content of the webview based on the active editor.
 * @method updateTitle - Updates the title of the webview based on its state.
 * @method getHtmlForWebview - Generates the HTML content for the webview.
 * @method getHtmlContentForActiveEditor - Retrieves the HTML content for the active editor.
 * @method getMarkdown - Converts a MarkedString or MarkdownString to a string.
 */
export class DefinitionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'CodePrism.view.definitionView'
  public static readonly pinnedContext = 'CodePrism.context.definitionView.isPinned'

  private view?: vscode.WebviewView
  private loading?: { cts: vscode.CancellationTokenSource }
  private pinned = false

  private readonly _disposables: vscode.Disposable[] = []

  private readonly renderer = new DefinitionViewRenderer()
  // private _currentCacheKey: CacheKey = cacheKeyNone
  // private _updateMode = UpdateMode.Live

  /**
   * Creates an instance of DefinitionViewProvider.
   *
   * @param extensionUri - The URI of the extension.
   *
   * This constructor sets up event listeners for various VS Code events:
   * - `onDidChangeActiveTextEditor`: Triggered when the active text editor changes.
   * - `onDidChangeTextEditorSelection`: Triggered when the text editor selection changes.
   *
   * The event listeners call the `update` method to refresh the view.
   *
   * Note: Some event listeners and method calls are commented out, which might be used for configuration changes and rendering updates.
   */
  constructor(private readonly extensionUri: vscode.Uri) {
    vscode.window.onDidChangeActiveTextEditor(
      () => {
        this.update()
      },
      null,
      this._disposables
    )

    vscode.window.onDidChangeTextEditorSelection(
      () => {
        this.update()
      },
      null,
      this._disposables
    )

    // vscode.workspace.onDidChangeConfiguration(
    //   () => {
    //     this.updateConfiguration()
    //   },
    //   null,
    //   this._disposables
    // )

    // this.renderer.needsRender(
    //   () => {
    //     this.update(/* force */ true)
    //   },
    //   undefined,
    //   this._disposables
    // )

    // this.updateConfiguration()
    this.update()
  }

  /**
   * Disposes of all the disposables in the `_disposables` array.
   * This method iterates through the `_disposables` array, popping each item
   * and calling its `dispose` method to release any resources held by the item.
   */
  dispose() {
    let item: vscode.Disposable | undefined
    while ((item = this._disposables.pop())) {
      item.dispose()
    }
  }

  /**
   * Resolves the webview view when it becomes visible.
   * resolveWebviewView 메서드는 웹뷰를 생성하고 초기화하는 데 사용됩니다.
   * 이 메서드는 웹뷰가 표시될 때마다 호출되며, 웹뷰의 콘텐츠를 설정하고 초기 상태를 구성하는 역할을 합니다.
   *
   * @param webviewView - The webview view to be resolved.
   * @param context - The context in which the webview view is being resolved.
   * @param token - A cancellation token that indicates when the resolve operation is canceled.
   *
   * This method sets up the webview options, handles visibility changes, and disposes of the view when necessary.
   * It also updates the title and the HTML content of the webview.
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'asset')],
    }

    // 웹뷰의 HTML 콘텐츠 설정
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview)

    // 웹뷰에 메시지 핸들러 추가
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'alert':
          vscode.window.showErrorMessage(message.text)
          break
      }
    })

    // 웹뷰의 가시성 상태 변경 핸들러 추가
    webviewView.onDidChangeVisibility(() => {
      if (this.view?.visible) {
        this.update(/* force */ true)
      }
    })

    // 웹뷰가 폐기될 때 핸들러 추가
    webviewView.onDidDispose(() => {
      this.view = undefined
    })

    this.updateTitle()
    this.update(/* force */ true)
  }

  /**
   * Generates the HTML content for the webview.
   *
   * @param webview - The webview instance for which the HTML content is being generated.
   * @returns The HTML content as a string.
   *
   * The generated HTML includes:
   * - A link to the main CSS file for styling.
   * - A script tag with a nonce for security, linking to the main JavaScript file.
   * - A Content Security Policy (CSP) that restricts sources for styles, scripts, and images.
   */
  private getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'asset', 'main.js'))
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'asset', 'main.css'))
    const prismJs = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'asset', 'prism.js'))
    const prismCss = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'asset', 'prism.css'))

    const nonce = getNonce()

    return `
      <!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="
					default-src 'none';
					style-src ${webview.cspSource} 'unsafe-inline';
					script-src 'nonce-${nonce}';
					img-src data: https:;
					">
				<link href="${styleUri}" rel="stylesheet">
				<link href="${prismCss}" rel="stylesheet">
				<title>Definition View</title>
			</head>
			<body>
				<article id="main"></article>
				<script nonce="${nonce}" src="${scriptUri}"></script>
        <script src="${prismJs}"></script>
			</body>
			</html>`
  }

  /**
   * Pins the current view.
   * This method updates the pin status to true.
   */
  pin() {
    this.updatePin(true)
  }

  /**
   * Unpins the current item by updating its pin status to false.
   * This method calls the `updatePin` function with a parameter of `false`.
   */
  unpin() {
    this.updatePin(false)
  }

  /**
   * Updates the pinned state of the definition view.
   *
   * @param value - The new pinned state to set. If the current pinned state is the same as the provided value, the method returns early.
   *
   * @remarks
   * This method updates the `pinned` property and sets the context for the `DefinitionViewProvider.pinnedContext` command.
   * It also triggers an update of the view.
   */
  private updatePin(value: boolean) {
    if (this.pinned === value) {
      return
    }

    this.pinned = value
    vscode.commands.executeCommand('setContext', DefinitionViewProvider.pinnedContext, value)

    this.update()
  }

  /**
   * Updates the title description of the view based on the pinned state.
   * If the view is not available, the function returns immediately.
   * If the view is available, it sets the description to '(pinned)' if the view is pinned,
   * otherwise, it sets the description to undefined.
   */
  private updateTitle() {
    if (!this.view) {
      return
    }
    this.view.description = this.pinned ? '(pinned)' : undefined
  }

  /**
   * Updates the view with the latest content. If the view is pinned or loading, it cancels the current loading process.
   * It fetches the HTML content for the active editor and posts a message to the webview with the content.
   * If no content is found, it posts a 'noContent' message.
   *
   * @param ignoreCache - If true, the cache is ignored and the content is fetched anew.
   * @returns A promise that resolves when the update process is complete.
   */
  private async update(ignoreCache = false) {
    if (!this.view) {
      return
    }

    this.updateTitle()

    if (this.pinned) {
      return
    }

    // const newCacheKey = createCacheKey(vscode.window.activeTextEditor)
    // if (!ignoreCache && cacheKeyEquals(this._currentCacheKey, newCacheKey)) {
    //   return
    // }

    // this._currentCacheKey = newCacheKey

    if (this.loading) {
      this.loading.cts.cancel()
      this.loading = undefined
    }

    const loadingEntry = { cts: new vscode.CancellationTokenSource() }
    this.loading = loadingEntry

    const updatePromise = (async () => {
      const html = await this.getHtmlContentForActiveEditor(loadingEntry.cts.token)
      if (loadingEntry.cts.token.isCancellationRequested) {
        return
      }

      if (this.loading !== loadingEntry) {
        // A new entry has started loading since we started
        return
      }
      this.loading = undefined

      if (html.length) {
        this.view?.webview.postMessage({
          type: 'update',
          body: html,
          // updateMode: this._updateMode,
        })
      } else {
        this.view?.webview.postMessage({
          type: 'noContent',
          body: 'No symbol found at current cursor position',
          // updateMode: this._updateMode,
        })
      }
    })()

    await Promise.race([
      updatePromise,

      // Don't show progress indicator right away, which causes a flash
      new Promise<void>(resolve => setTimeout(resolve, 250)).then(() => {
        if (loadingEntry.cts.token.isCancellationRequested) {
          return
        }
        return vscode.window.withProgress(
          { location: { viewId: DefinitionViewProvider.viewType } },
          () => updatePromise
        )
      }),
    ])
  }

  /**
   * Retrieves the HTML content for the active editor by executing hover and definition providers.
   *
   * @param token - A cancellation token to signal the operation should be canceled.
   * @returns A promise that resolves to a string containing the HTML content.
   *
   * The function performs the following steps:
   * 1. Checks if there is an active text editor. If not, returns an empty string.
   * 2. Executes the hover provider command to get hover information for the current selection.
   * 3. Executes the definition provider command to get definition locations for the current selection.
   * 4. Checks if the cancellation token has been triggered. If so, returns an empty string.
   * 5. Processes the hover contents to extract markdown parts.
   * 6. If there are no markdown parts, returns an empty string.
   * 7. Joins the markdown parts and appends the file contents in a code block.
   * 8. Converts the markdown to HTML and returns it.
   *
   * If an error occurs during the process, an error message is shown and logged, and an empty string is returned.
   */
  private async getHtmlContentForActiveEditor(token: vscode.CancellationToken): Promise<string> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      return ''
    }

    try {
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        editor.document.uri,
        editor.selection.active
      )

      const locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
        'vscode.executeDefinitionProvider',
        editor.document.uri,
        editor.selection.active
      )

      if (token.isCancellationRequested) {
        return ''
      }

      const parts = hovers
        .flatMap(hover => hover.contents)
        .map(content => this.getMarkdown(content))
        .filter(content => content.length > 0)

      if (!parts.length) {
        return ''
      }
      let markdown = parts.join('\n')

      if (locations.length) {
        // markdown에서 --- 는 horizontal rule을 의미하는데 이것이 바로 밑에 나오면 위의 내용을 제목으로 인식한다.
        // 따라서 --- 를 추가할때는 \n 하나만 사용하면 안된다.
        markdown += '\n\n---\n'
        markdown += '```typescript\n' + (await this.renderer.renderDefinitions(editor.document, locations)) + '\n```\n'
      }

      return this.renderer.render(markdown)
    } catch (error) {
      vscode.window.showErrorMessage(`정의 찾기 오류: ${error}`)
      console.error(error)
    }
    return ''
  }

  /**
   * Converts a given `vscode.MarkedString` or `vscode.MarkdownString` to a string.
   *
   * @param content - The content to be converted. It can be either a `vscode.MarkedString` or `vscode.MarkdownString`.
   * @returns The string representation of the provided content.
   *
   * - If the content is a plain string, it returns the string as is.
   * - If the content is an instance of `vscode.MarkdownString`, it returns the `value` property of the `MarkdownString`.
   * - If the content is an instance of `vscode.MarkedString`, it creates a new `vscode.MarkdownString`, appends the code block with the content's value and language, and returns the `value` property of the new `MarkdownString`.
   */
  private getMarkdown(content: vscode.MarkedString | vscode.MarkdownString): string {
    if (typeof content === 'string') {
      return content
    } else if (content instanceof vscode.MarkdownString) {
      return content.value
    } else {
      const markdown = new vscode.MarkdownString()
      markdown.appendCodeblock(content.value, content.language)
      return markdown.value
    }
  }

  // private updateConfiguration() {
  //   const config = vscode.workspace.getConfiguration('defView')
  //   this._updateMode = config.get<UpdateMode>('definitionView.updateMode') || UpdateMode.Live
  // }
}

/**
 * Generates a random nonce string.
 *
 * The nonce is a 32-character string consisting of uppercase letters,
 * lowercase letters, and digits. This can be used for security purposes
 * such as Content Security Policy (CSP) to prevent certain types of attacks.
 *
 * @returns {string} A randomly generated 32-character nonce string.
 */
function getNonce() {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

// type CacheKey = typeof cacheKeyNone | DocumentCacheKey

// const cacheKeyNone = { type: 'none' } as const

// class DocumentCacheKey {
//   readonly type = 'document'

//   constructor(
//     public readonly url: vscode.Uri,
//     public readonly version: number,
//     public readonly wordRange: vscode.Range | undefined
//   ) {}

//   public equals(other: DocumentCacheKey): boolean {
//     if (this.url.toString() !== other.url.toString()) {
//       return false
//     }

//     if (this.version !== other.version) {
//       return false
//     }

//     if (other.wordRange === this.wordRange) {
//       return true
//     }

//     if (!other.wordRange || !this.wordRange) {
//       return false
//     }

//     return this.wordRange.isEqual(other.wordRange)
//   }
// }

// function cacheKeyEquals(a: CacheKey, b: CacheKey): boolean {
//   if (a === b) {
//     return true
//   }

//   if (a.type !== b.type) {
//     return false
//   }

//   if (a.type === 'none' || b.type === 'none') {
//     return false
//   }

//   return a.equals(b)
// }

// function createCacheKey(editor: vscode.TextEditor | undefined): CacheKey {
//   if (!editor) {
//     return cacheKeyNone
//   }

//   return new DocumentCacheKey(
//     editor.document.uri,
//     editor.document.version,
//     editor.document.getWordRangeAtPosition(editor.selection.active)
//   )
// }

/**
 *
 * @param context
 */
export function definition_activate(context: vscode.ExtensionContext) {
  // extensionUri 속성은 확장 프로그램의 루트 디렉토리를 나타내는 URI입니다.
  // 이 URI는 확장 프로그램이 설치된 위치를 가리키며,
  // 확장 프로그램의 리소스 파일(예: HTML, CSS, JavaScript 파일 등)에 접근할 때 유용합니다
  const definitionProvider = new DefinitionViewProvider(context.extensionUri)
  context.subscriptions.push(definitionProvider)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DefinitionViewProvider.viewType, definitionProvider)
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.definitionView.pin', () => {
      definitionProvider.pin()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.definitionView.unpin', () => {
      definitionProvider.unpin()
    })
  )
}